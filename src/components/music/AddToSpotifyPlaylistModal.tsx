/**
 * MoodMap — Add to Spotify Playlist Modal
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  ListRenderItemInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius } from '@/constants/layout';
import { useTierStore } from '@/stores/tierStore';
import { useSpotify } from '@/hooks/useSpotify';
import {
  getUserPlaylists,
  createPlaylist as spotifyCreatePlaylist,
  addTracksToPlaylist as spotifyAddTracksToPlaylist,
  getCurrentUser,
  formatSpotifyTrackUri,
  resolveSpotifyTrackUri,
  type SpotifyPlaylist,
  type SpotifyUser,
} from '@/services/spotify';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const COMPACT_HEIGHT = Math.round(SCREEN_HEIGHT * 0.64);
const EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.88);

export interface SpotifyTrackTarget {
  id: string;
  title: string;
  artist: string;
  cover?: string;
  uri?: string;
}

interface AddToSpotifyPlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  track: SpotifyTrackTarget | null;
  onSuccess?: (playlistName: string) => void;
}

// Memoized individual playlist row for maximum 60/120fps list smoothness
const PlaylistItemRow = React.memo(({
  item,
  isAdding,
  isAdded,
  isOwner,
  onSelect,
  disabled,
}: {
  item: SpotifyPlaylist;
  isAdding: boolean;
  isAdded: boolean;
  isOwner: boolean;
  onSelect: (item: SpotifyPlaylist) => void;
  disabled: boolean;
}) => {
  const coverUrl = item.images?.[0]?.url;
  const trackCount = item.tracks?.total ?? (item as any).items?.total ?? 0;

  const handlePress = useCallback(() => {
    onSelect(item);
  }, [item, onSelect]);

  return (
    <Pressable
      style={[
        styles.playlistItem,
        isAdded && styles.playlistItemAdded,
      ]}
      onPress={handlePress}
      disabled={disabled}
    >
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          style={styles.playlistCover}
          cachePolicy="memory-disk"
          transition={100}
        />
      ) : (
        <View style={[styles.playlistCover, styles.playlistCoverFallback]}>
          <Feather name="folder" size={18} color="#1DB954" />
        </View>
      )}

      <View style={styles.playlistInfo}>
        <Text numberOfLines={1} style={styles.playlistName}>
          {item.name}
        </Text>
        <View style={styles.playlistMetaRow}>
          <Text style={styles.playlistTrackCount}>
            {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
          </Text>
          {item.owner?.display_name ? (
            <>
              <Text style={styles.metaDot}>•</Text>
              <Text numberOfLines={1} style={styles.playlistOwner}>
                {isOwner ? 'By You' : `by ${item.owner.display_name}`}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.playlistActionSlot}>
        {isAdding ? (
          <ActivityIndicator size="small" color="#1DB954" />
        ) : isAdded ? (
          <View style={styles.checkBadge}>
            <Feather name="check" size={14} color="#000000" />
          </View>
        ) : (
          <View style={styles.addPlusBtn}>
            <Feather name="plus" size={15} color="#1DB954" />
          </View>
        )}
      </View>
    </Pressable>
  );
});

PlaylistItemRow.displayName = 'PlaylistItemRow';

export const AddToSpotifyPlaylistModal: React.FC<AddToSpotifyPlaylistModalProps> = ({
  visible,
  onClose,
  track,
  onSuccess,
}) => {
  const spotifyConnected = useTierStore((s) => s.spotifyConnected);
  const getValidAccessToken = useTierStore((s) => s.getValidAccessToken);
  const { connect: connectSpotify } = useSpotify();

  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [addedPlaylistId, setAddedPlaylistId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Expand state & Reanimated shared values
  const [isExpanded, setIsExpanded] = useState(false);
  const expandProgress = useSharedValue(0); // 0 = compact, 1 = expanded
  const modalOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(60);

  // New playlist creation state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isNewPlaylistFocused, setIsNewPlaylistFocused] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const newPlaylistInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setAddedPlaylistId(null);
      setAddingToId(null);
      setErrorMessage(null);
      setIsCreatingNew(false);
      setNewPlaylistName('');
      setIsExpanded(false);
      expandProgress.value = 0;

      modalOpacity.value = withTiming(1, { duration: 180 });
      modalTranslateY.value = withSpring(0, { damping: 20, stiffness: 160 });

      loadPlaylists();
    } else {
      modalOpacity.value = withTiming(0, { duration: 140 });
      modalTranslateY.value = withTiming(60, { duration: 140 });
      Keyboard.dismiss();
    }
  }, [visible]);

  const toggleExpand = useCallback((targetState?: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = targetState !== undefined ? targetState : !isExpanded;
    expandProgress.value = withSpring(next ? 1 : 0, { damping: 22, stiffness: 160 });
    setIsExpanded(next);
  }, [isExpanded, expandProgress]);

  const handleStartCreateNew = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErrorMessage(null);
    setIsCreatingNew(true);
    toggleExpand(true);
    setTimeout(() => {
      newPlaylistInputRef.current?.focus();
    }, 150);
  }, [toggleExpand]);

  const handleCancelCreateNew = useCallback(() => {
    setIsCreatingNew(false);
    setNewPlaylistName('');
    Keyboard.dismiss();
  }, []);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const token = await getValidAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const [user, userPlaylists] = await Promise.all([
        getCurrentUser(token),
        getUserPlaylists(token, 50),
      ]);

      if (user) setSpotifyUser(user);
      if (userPlaylists) setPlaylists(userPlaylists);
    } catch (err) {
      console.warn('[AddToSpotifyPlaylistModal] Error loading playlists:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlaylists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return playlists.filter((pl) => {
      if (!q) return true;
      return pl.name.toLowerCase().includes(q);
    });
  }, [playlists, searchQuery]);

  const handleSelectPlaylist = useCallback(async (pl: SpotifyPlaylist) => {
    if (!track || addingToId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddingToId(pl.id);
    setErrorMessage(null);

    try {
      const token = await getValidAccessToken();
      if (!token) {
        setErrorMessage('Spotify session expired. Please tap Reconnect.');
        setAddingToId(null);
        return;
      }

      // Resolve legitimate Spotify track URI (searches by title+artist if non-Spotify or fallback ID)
      const trackUri = await resolveSpotifyTrackUri(token, track);
      if (!trackUri) {
        setErrorMessage('Could not locate this track on Spotify.');
        setAddingToId(null);
        return;
      }

      const result = await spotifyAddTracksToPlaylist(token, pl.id, [trackUri]);

      if (result.success || result.snapshot_id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAddedPlaylistId(pl.id);
        onSuccess?.(pl.name);

        setTimeout(() => {
          onClose();
        }, 400);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const errMsg = result.error || `Could not add track to "${pl.name}".`;
        setErrorMessage(errMsg);
        setAddingToId(null);
      }
    } catch (err) {
      console.warn('[AddToSpotifyPlaylistModal] Failed to add track:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage('Failed to add track. Please try again.');
      setAddingToId(null);
    }
  }, [track, addingToId, getValidAccessToken, onSuccess, onClose]);

  const handleCreateAndAdd = useCallback(async () => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed || !track || isCreating) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsCreating(true);
    setErrorMessage(null);
    Keyboard.dismiss();

    try {
      const token = await getValidAccessToken();
      if (!token) {
        setErrorMessage('Spotify session expired. Please tap Reconnect.');
        setIsCreating(false);
        return;
      }

      let userId = spotifyUser?.id;
      if (!userId) {
        const u = await getCurrentUser(token);
        userId = u?.id;
      }

      const newPl = await spotifyCreatePlaylist(token, userId || '', trimmed, 'Created via MooDMap');
      if (newPl?.id) {
        const trackUri = await resolveSpotifyTrackUri(token, track);
        let addSuccess = false;
        let addErr: string | undefined;

        if (trackUri) {
          const addRes = await spotifyAddTracksToPlaylist(token, newPl.id, [trackUri]);
          if (addRes.success || addRes.snapshot_id) {
            addSuccess = true;
          } else {
            addErr = addRes.error;
          }
        }

        if (addSuccess) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setPlaylists((prev) => [newPl, ...prev]);
          setAddedPlaylistId(newPl.id);
          onSuccess?.(newPl.name);

          setTimeout(() => {
            onClose();
          }, 400);
        } else {
          setPlaylists((prev) => [newPl, ...prev]);
          setErrorMessage(`Created "${newPl.name}", but track could not be added: ${addErr || 'Track not found'}.`);
          setIsCreating(false);
        }
      } else {
        setErrorMessage('Could not create playlist on Spotify. Please tap Reconnect.');
        setIsCreating(false);
      }
    } catch (err) {
      console.warn('[AddToSpotifyPlaylistModal] Error creating playlist:', err);
      setErrorMessage('Error creating playlist.');
      setIsCreating(false);
    }
  }, [newPlaylistName, track, isCreating, getValidAccessToken, spotifyUser?.id, onSuccess, onClose]);

  // Animated styles
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    const h = interpolate(expandProgress.value, [0, 1], [COMPACT_HEIGHT, EXPANDED_HEIGHT]);
    return {
      height: h,
      transform: [{ translateY: modalTranslateY.value }],
    };
  });

  const renderPlaylistItem = useCallback(({ item }: ListRenderItemInfo<SpotifyPlaylist>) => {
    const isAdding = addingToId === item.id;
    const isAdded = addedPlaylistId === item.id;
    const isOwner = !spotifyUser || item.owner?.id === spotifyUser.id;

    return (
      <PlaylistItemRow
        item={item}
        isAdding={isAdding}
        isAdded={isAdded}
        isOwner={isOwner}
        onSelect={handleSelectPlaylist}
        disabled={!!addingToId}
      />
    );
  }, [addingToId, addedPlaylistId, spotifyUser, handleSelectPlaylist]);

  const keyExtractor = useCallback((item: SpotifyPlaylist) => item.id, []);

  // Fixed item layout (58px item + 8px gap) skips expensive JS-side measurement for large libraries
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: 66,
      offset: 66 * index,
      index,
    }),
    []
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        {/* Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, backdropAnimatedStyle]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 40 : 25}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
          style={styles.keyboardAvoid}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[styles.sheetContainer, sheetAnimatedStyle]}
            pointerEvents="box-none"
          >
            {/* Sheet Card */}
            <View style={styles.sheetCard}>
              <LinearGradient
                colors={['rgba(24, 30, 26, 0.98)', 'rgba(14, 18, 16, 0.99)', 'rgba(10, 13, 12, 1)']}
                locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFill}
              />

              {/* Interactive Top Expand / Drag Handle Bar */}
              <Pressable
                style={styles.topHandleBar}
                onPress={() => toggleExpand()}
                hitSlop={12}
              >
                <View style={styles.dragHandlePill} />
                <View style={styles.expandLabelRow}>
                  <Feather
                    name={isExpanded ? 'chevron-down' : 'chevron-up'}
                    size={12}
                    color="#1DB954"
                  />
                  <Text style={styles.expandLabelText}>
                    {isExpanded ? 'Collapse View' : 'Tap to expand view'}
                  </Text>
                </View>
              </Pressable>

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <View style={styles.spotifyIconBadge}>
                    <Feather name="folder-plus" size={16} color="#1DB954" />
                  </View>
                  <View>
                    <Text style={styles.headerTitle}>Add to Spotify Playlist</Text>
                    <Text style={styles.headerSubtitle}>Save to your Spotify library</Text>
                  </View>
                </View>

                <View style={styles.headerActions}>
                  <Pressable
                    onPress={() => toggleExpand()}
                    hitSlop={8}
                    style={styles.expandToggleBtn}
                  >
                    <Feather
                      name={isExpanded ? 'minimize-2' : 'maximize-2'}
                      size={14}
                      color="#1DB954"
                    />
                  </Pressable>
                  <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                    <Feather name="x" size={16} color="rgba(255, 255, 255, 0.8)" />
                  </Pressable>
                </View>
              </View>

              {/* Target Track Preview Banner */}
              {track && (
                <View style={styles.trackBanner}>
                  {track.cover ? (
                    <Image
                      source={{ uri: track.cover }}
                      style={styles.trackBannerCover}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.trackBannerCover, styles.trackBannerCoverFallback]}>
                      <Feather name="music" size={16} color="#1DB954" />
                    </View>
                  )}
                  <View style={styles.trackBannerInfo}>
                    <Text numberOfLines={1} style={styles.trackBannerTitle}>
                      {track.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.trackBannerArtist}>
                      {track.artist}
                    </Text>
                  </View>
                  <View style={styles.spotifyBrandBadge}>
                    <View style={styles.spotifyDot} />
                    <Text style={styles.spotifyBrandText}>Spotify</Text>
                  </View>
                </View>
              )}

              {/* Inline Error Notification Banner */}
              {errorMessage && (
                <View style={styles.errorBanner}>
                  <View style={styles.errorBannerTopRow}>
                    <Feather name="alert-circle" size={15} color="#EF4444" style={{ marginTop: 1 }} />
                    <Text style={styles.errorBannerText}>
                      {errorMessage}
                    </Text>
                    <Pressable onPress={() => setErrorMessage(null)} hitSlop={8} style={{ padding: 2 }}>
                      <Feather name="x" size={13} color="rgba(255,255,255,0.7)" />
                    </Pressable>
                  </View>
                  {(errorMessage.includes('reconnect') ||
                    errorMessage.includes('Reconnect') ||
                    errorMessage.includes('permission') ||
                    errorMessage.includes('Permission')) && (
                    <Pressable
                      style={styles.reconnectBtn}
                      onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onClose();
                        await connectSpotify();
                      }}
                    >
                      <Feather name="refresh-cw" size={11} color="#000000" />
                      <Text style={styles.reconnectBtnText}>Reconnect Spotify (Grant Permissions)</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Top: Create New Playlist Form (Positioned at the TOP so keyboard never obscures it!) */}
              {isCreatingNew ? (
                <View style={styles.createNewWrapper}>
                  <View style={styles.createNewHeaderRow}>
                    <Text style={styles.createNewSectionTitle}>Create New Spotify Playlist</Text>
                    <Pressable onPress={handleCancelCreateNew} hitSlop={8}>
                      <Feather name="x" size={15} color="rgba(255, 255, 255, 0.6)" />
                    </Pressable>
                  </View>

                  <View style={styles.createNewInputRow}>
                    <View
                      style={[
                        styles.createNewInputContainer,
                        isNewPlaylistFocused && styles.createNewInputContainerFocused,
                      ]}
                    >
                      <Feather name="edit-2" size={14} color="#1DB954" style={{ marginRight: 8 }} />
                      <TextInput
                        ref={newPlaylistInputRef}
                        style={styles.createNewInput}
                        placeholder="Name your playlist..."
                        placeholderTextColor="rgba(255, 255, 255, 0.4)"
                        value={newPlaylistName}
                        onChangeText={setNewPlaylistName}
                        onFocus={() => setIsNewPlaylistFocused(true)}
                        onBlur={() => setIsNewPlaylistFocused(false)}
                        autoCapitalize="sentences"
                        returnKeyType="done"
                        onSubmitEditing={handleCreateAndAdd}
                      />
                    </View>

                    <Pressable
                      style={[
                        styles.createNewSubmitBtn,
                        (!newPlaylistName.trim() || isCreating) && { opacity: 0.5 },
                      ]}
                      onPress={handleCreateAndAdd}
                      disabled={!newPlaylistName.trim() || isCreating}
                    >
                      {isCreating ? (
                        <ActivityIndicator size="small" color="#000000" />
                      ) : (
                        <>
                          <Feather name="plus" size={14} color="#000000" />
                          <Text style={styles.createNewSubmitText}>Save</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                /* Search Bar */
                <View
                  style={[
                    styles.searchRow,
                    isSearchFocused && styles.searchRowFocused,
                  ]}
                >
                  <Feather
                    name="search"
                    size={15}
                    color={isSearchFocused ? '#1DB954' : 'rgba(255, 255, 255, 0.5)'}
                    style={styles.searchIcon}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search your playlists..."
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onFocus={() => {
                      setIsSearchFocused(true);
                      if (!isExpanded) toggleExpand(true);
                    }}
                    onBlur={() => setIsSearchFocused(false)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                      <Feather name="x" size={14} color="rgba(255, 255, 255, 0.6)" />
                    </Pressable>
                  )}
                </View>
              )}

              {/* Playlists Viewport (High-Performance FlatList) */}
              <View style={styles.listWrapper}>
                {loading ? (
                  <View style={styles.centerLoading}>
                    <ActivityIndicator size="small" color="#1DB954" />
                    <Text style={styles.loadingText}>Fetching your Spotify playlists...</Text>
                  </View>
                ) : !spotifyConnected ? (
                  <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconCircle}>
                      <Feather name="link" size={22} color="#1DB954" />
                    </View>
                    <Text style={styles.emptyTitle}>Spotify Not Connected</Text>
                    <Text style={styles.emptySubtitle}>
                      Connect your Spotify account to save songs directly to your playlists.
                    </Text>
                  </View>
                ) : filteredPlaylists.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' }]}>
                      <Feather name="music" size={22} color="rgba(255, 255, 255, 0.4)" />
                    </View>
                    <Text style={styles.emptyTitle}>
                      {searchQuery ? 'No matching playlists found' : 'No playlists yet'}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                      {searchQuery
                        ? 'Try a different keyword or create a new playlist below.'
                        : 'Create your first Spotify playlist below to save this track.'}
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredPlaylists}
                    renderItem={renderPlaylistItem}
                    keyExtractor={keyExtractor}
                    getItemLayout={getItemLayout}
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    windowSize={4}
                    updateCellsBatchingPeriod={40}
                    removeClippedSubviews={true}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                    style={styles.scrollList}
                  />
                )}
              </View>

              {/* Bottom: Trigger for Creating New Playlist (if not active) */}
              {!isCreatingNew && (
                <>
                  <View style={styles.bottomDivider} />
                  <Pressable
                    style={styles.newPlaylistBtn}
                    onPress={handleStartCreateNew}
                  >
                    <View style={styles.newPlaylistIconBg}>
                      <Feather name="plus" size={16} color="#1DB954" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.newPlaylistText}>Create New Spotify Playlist</Text>
                      <Text style={styles.newPlaylistSubText}>Make a new playlist and add this song</Text>
                    </View>
                    <Feather name="chevron-right" size={15} color="rgba(255, 255, 255, 0.4)" />
                  </Pressable>
                </>
              )}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },
  sheetCard: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    backgroundColor: '#0E1210',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  topHandleBar: {
    width: '100%',
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandlePill: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  expandLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  expandLabelText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 10,
    color: '#1DB954',
    letterSpacing: 0.2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  spotifyIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  expandToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(29, 185, 84, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: 2,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: Spacing.md,
  },
  trackBannerCover: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  trackBannerCoverFallback: {
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackBannerInfo: {
    flex: 1,
  },
  trackBannerTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: '#FFFFFF',
  },
  trackBannerArtist: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 2,
  },
  spotifyBrandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 185, 84, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.35)',
    gap: 4,
  },
  spotifyDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#1DB954',
  },
  spotifyBrandText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
    color: '#1DB954',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  errorBanner: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: 8,
  },
  errorBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.tiny,
    color: '#FCA5A5',
    lineHeight: 16,
  },
  reconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1DB954',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    gap: 6,
    alignSelf: 'flex-start',
  },
  reconnectBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    color: '#000000',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 40,
    borderRadius: Radius.card,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchRowFocused: {
    borderColor: 'rgba(29, 185, 84, 0.6)',
    backgroundColor: 'rgba(29, 185, 84, 0.08)',
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  listWrapper: {
    flex: 1,
    minHeight: 120,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 4,
    gap: 8,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  loadingText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  emptyContainer: {
    flex: 1,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(29, 185, 84, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.card,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    gap: Spacing.md,
  },
  playlistItemAdded: {
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    borderColor: 'rgba(29, 185, 84, 0.5)',
  },
  playlistCover: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  playlistCoverFallback: {
    backgroundColor: 'rgba(29, 185, 84, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: '#FFFFFF',
  },
  playlistMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  playlistTrackCount: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.tiny,
    color: '#1DB954',
  },
  metaDot: {
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.35)',
  },
  playlistOwner: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  playlistActionSlot: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlusBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(29, 185, 84, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    marginTop: Spacing.xs,
  },
  newPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  newPlaylistIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(29, 185, 84, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newPlaylistText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.bodySmall,
    color: '#1DB954',
  },
  newPlaylistSubText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2,
  },
  createNewWrapper: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.card,
    backgroundColor: 'rgba(29, 185, 84, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.3)',
  },
  createNewSectionTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny,
    color: '#1DB954',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  createNewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  createNewInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  createNewInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  createNewInputContainerFocused: {
    borderColor: '#1DB954',
    backgroundColor: 'rgba(29, 185, 84, 0.12)',
  },
  createNewInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  createNewSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: Spacing.lg,
    backgroundColor: '#1DB954',
    borderRadius: Radius.card,
    gap: 4,
  },
  createNewSubmitText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption,
    color: '#000000',
  },
});
