/**
 * MoodMap — Music Taste Survey Screen
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInRight,
  FadeOutLeft,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { GradientBackground, GlassCard, Button, customAlert } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import { useSpotify } from '@/hooks/useSpotify';
import {
  getMusicPreferences,
  saveMusicPreferences,
  MASTER_GENRES,
  MUSIC_LANGUAGES,
  DECADE_OPTIONS,
  type MusicPreferences,
} from '@/services/musicPreferenceService';
import type { SpotifyArtist } from '@/services/spotify';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TOTAL_STEPS = 4;

const POPULAR_SEED_ARTISTS: SpotifyArtist[] = [
  {
    id: '4YRxDV8wJFPHPvhScvPw1v',
    name: 'Arijit Singh',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb0261696c5df3be99da6ed3f3', width: 300, height: 300 }],
  },
  {
    id: '1Xyo4u8uXC1ZmMpatF05PJ',
    name: 'The Weeknd',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb214f3cf0651f67f232490ab2', width: 300, height: 300 }],
  },
  {
    id: '06HL4zFStm1WTuVvUZ5ofE',
    name: 'Taylor Swift',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb5a00969a4698c3132a15fbb0', width: 300, height: 300 }],
  },
  {
    id: '1wRPtKGflZfg9q3sIGwvfa',
    name: 'Pritam',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5ebcb52227181c039d914589d87', width: 300, height: 300 }],
  },
  {
    id: '3TVXtAsR1Inumwj472S9r4',
    name: 'Drake',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb4293385d324db855814dabb7', width: 300, height: 300 }],
  },
  {
    id: '246voRFvSl12kgFvPzMYOO',
    name: 'Post Malone',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5ebd8b8686616194cae0f252cf4', width: 300, height: 300 }],
  },
  {
    id: '7vk5e3vY1uw9OXVh2pELnH',
    name: 'Alan Walker',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5ebdf1b6068222956cfb9e2c6ba', width: 300, height: 300 }],
  },
  {
    id: '4bU1KXEZzZ9wLkoR9oW3Vn',
    name: 'Ava Max',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb6046e7f22ddcf3d1ebdd1c09', width: 300, height: 300 }],
  },
  {
    id: '66CXW0PSpKCYvHvSD9IRhB',
    name: 'Dua Lipa',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb561b369c735d460d3d34cf40', width: 300, height: 300 }],
  },
  {
    id: '6qqNVTkY8uBg9cP3JSuPBY',
    name: 'Billie Eilish',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb799f9ef7f90f23d6a36fa1be', width: 300, height: 300 }],
  },
  {
    id: '6eUKZXaKkcviH0Ku9w2n3V',
    name: 'Ed Sheeran',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb12a0fef2662054ffcf1583d8', width: 300, height: 300 }],
  },
  {
    id: '4gzpqT2WigCFS5pP0krmxq',
    name: 'Coldplay',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5ebbb4e73b22b2713f0440f90bd', width: 300, height: 300 }],
  },
  {
    id: '4q3ewBCX7sLrzBOAODJhST',
    name: 'Bad Bunny',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb9944747c320d3c631e8a9364', width: 300, height: 300 }],
  },
  {
    id: '3Nrf22cJPZFyC2fA24bKG5',
    name: 'BTS',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb00181518f8eb069c36209503', width: 300, height: 300 }],
  },
  {
    id: '1uNF2HRcR2ZsM3bRg9xNxF',
    name: 'Justin Bieber',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb8ae7f2aaa9817a704a87ea36', width: 300, height: 300 }],
  },
  {
    id: '0o181nEjdFjiT76u8qF9zX',
    name: 'Shreya Ghoshal',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb9b417c88b90ed74f7be33f57', width: 300, height: 300 }],
  },
  {
    id: '1mYsTxn3TcF09yipuXW4oN',
    name: 'A.R. Rahman',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5ebb8e8a60ffcbb43bf7e23114d', width: 300, height: 300 }],
  },
  {
    id: '2fMonJ4acFi2FFqD2i8z19',
    name: 'Atif Aslam',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb16d1f05786ed655f4625ae78', width: 300, height: 300 }],
  },
  {
    id: '48S5eJ5y2D2Z1W0142hN11',
    name: 'Kumar Sanu',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb9df370eeeb425712f5a65fae', width: 300, height: 300 }],
  },
  {
    id: '70B8039TxF3VjVT2dSp512',
    name: 'Udit Narayan',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000e5ebb7e1e6992d9d1be693952d7e', width: 300, height: 300 }],
  },
];

/**
 * Helper to deduplicate artists by both normalized name AND ID.
 */
function dedupeArtists(artists: SpotifyArtist[]): SpotifyArtist[] {
  const result: SpotifyArtist[] = [];
  const keyToIdx = new Map<string, number>();

  for (const artist of artists) {
    if (!artist || !artist.name) continue;
    const normId = artist.id ? artist.id.toLowerCase().trim() : '';
    const cleanKey = artist.name.toLowerCase().replace(/[^a-z0-9]/g, '');

    let existingIdx = -1;
    if (normId && keyToIdx.has(`id:${normId}`)) {
      existingIdx = keyToIdx.get(`id:${normId}`)!;
    } else if (cleanKey && keyToIdx.has(`key:${cleanKey}`)) {
      existingIdx = keyToIdx.get(`key:${cleanKey}`)!;
    }

    if (existingIdx !== -1) {
      const existingObj = result[existingIdx];
      const existingImg = existingObj.images?.find((i) => !!i?.url)?.url;
      const newImg = artist.images?.find((i) => !!i?.url)?.url;

      // If existing artist has no image but the new match has an image, upgrade to the image-enabled artist object
      if (!existingImg && newImg) {
        result[existingIdx] = {
          ...existingObj,
          id: existingObj.id || artist.id,
          images: artist.images,
        };
      }
      if (normId && !keyToIdx.has(`id:${normId}`)) {
        keyToIdx.set(`id:${normId}`, existingIdx);
      }
      continue;
    }

    const newIdx = result.length;
    result.push(artist);
    if (normId) keyToIdx.set(`id:${normId}`, newIdx);
    if (cleanKey) keyToIdx.set(`key:${cleanKey}`, newIdx);
  }

  return result;
}

export default function MusicPreferencesSurveyScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const refreshData = useAppStore((s) => s.refreshData);
  const { loadTopArtistsForSurvey, searchArtistsForSurvey } = useSpotify();

  // Current Step (1 to 4)
  const [step, setStep] = useState(1);
  // Form State
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<Array<{ id: string; name: string }>>([]);
  const [customSelectedArtists, setCustomSelectedArtists] = useState<SpotifyArtist[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English']);
  const [selectedDecades, setSelectedDecades] = useState<string[]>(['2020s', '2010s']);
  const [energyPref, setEnergyPref] = useState<'low' | 'medium' | 'high' | 'any'>('any');
  const [instrumentalPref, setInstrumentalPref] = useState<'vocals' | 'instrumental' | 'any'>('any');
  const [discoveryLevel, setDiscoveryLevel] = useState<'familiar' | 'balanced' | 'adventurous'>('balanced');

  // Async data
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [artistSearchQuery, setArtistSearchQuery] = useState('');
  const [artistSearchResults, setArtistSearchResults] = useState<SpotifyArtist[]>([]);
  const [isSearchingArtists, setIsSearchingArtists] = useState(false);

  const [genreSearchQuery, setGenreSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load existing user preferences & top artists on mount
  useEffect(() => {
    (async () => {
      setLoadingInitial(true);
      try {
        let prefilledList: SpotifyArtist[] = [];
        if (user?.id) {
          const existing = getMusicPreferences(user.id);
          if (existing) {
            if (existing.favoriteGenres?.length) setSelectedGenres(existing.favoriteGenres);
            if (existing.favoriteArtistIds?.length) {
              const paired = existing.favoriteArtistIds.map((id, idx) => ({
                id,
                name: existing.favoriteArtistNames?.[idx] || 'Artist',
              }));
              setSelectedArtists(paired);

              // Pre-populate customSelectedArtists for main grid rendering
              prefilledList = paired.map((p) => {
                const match = POPULAR_SEED_ARTISTS.find(
                  (a) => a.id === p.id || a.name.toLowerCase().replace(/[^a-z0-9]/g, '') === p.name.toLowerCase().replace(/[^a-z0-9]/g, '')
                );
                return match || { id: p.id, name: p.name, images: [] };
              });
              setCustomSelectedArtists(prefilledList);
            }
            if (existing.preferredLanguages?.length) setSelectedLanguages(existing.preferredLanguages);
            if (existing.preferredDecades?.length) setSelectedDecades(existing.preferredDecades);
            if (existing.energyPreference) setEnergyPref(existing.energyPreference);
            if (existing.instrumentalPreference) setInstrumentalPref(existing.instrumentalPreference);
            if (existing.discoveryLevel) setDiscoveryLevel(existing.discoveryLevel);
          }
        }

        // Fetch top artists from Spotify API
        const artists = await loadTopArtistsForSurvey();
        setTopArtists(artists);

        // Enrich any prefilled saved artists missing profile pictures
        if (prefilledList.length > 0) {
          const missingPhoto = prefilledList.filter((a) => !a.images?.some((i) => !!i?.url));
          if (missingPhoto.length > 0) {
            const enriched = await Promise.all(
              missingPhoto.map(async (art) => {
                try {
                  const res = await searchArtistsForSurvey(art.name);
                  const found = res.find((r) => r.images?.some((i) => !!i?.url));
                  if (found) {
                    return { ...art, images: found.images };
                  }
                } catch {}
                return art;
              })
            );
            setCustomSelectedArtists((prev) =>
              prev.map((p) => enriched.find((e) => e.name === p.name && e.images?.length) || p)
            );
          }
        }
      } catch (err) {
        console.warn('[Survey] Initial load failed:', err);
      } finally {
        setLoadingInitial(false);
      }
    })();
  }, [user?.id, loadTopArtistsForSurvey, searchArtistsForSurvey]);

  // Handle Artist Search debounced (150ms for instant search feel)
  useEffect(() => {
    if (!artistSearchQuery.trim()) {
      setArtistSearchResults([]);
      setIsSearchingArtists(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingArtists(true);
      try {
        const results = await searchArtistsForSurvey(artistSearchQuery);
        setArtistSearchResults(results);
      } catch (e) {
        console.warn('[Survey] Artist search error:', e);
      } finally {
        setIsSearchingArtists(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [artistSearchQuery, searchArtistsForSurvey]);

  // Extract suggested genres dynamically from top artists' genre arrays
  const suggestedGenres = useMemo(() => {
    const genres = new Set<string>();
    for (const artist of topArtists) {
      if (artist.genres) {
        for (const g of artist.genres) {
          genres.add(g.toLowerCase());
        }
      }
    }
    return Array.from(genres);
  }, [topArtists]);

  // All combined genres list (Suggested first, then Master)
  const displayGenres = useMemo(() => {
    const query = genreSearchQuery.toLowerCase().trim();
    const combined = Array.from(new Set([...suggestedGenres, ...MASTER_GENRES]));

    if (!query) return combined;
    return combined.filter((g) => g.toLowerCase().includes(query));
  }, [suggestedGenres, genreSearchQuery]);

  // Toggle selection helpers
  const toggleGenre = (genre: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const toggleArtist = (artist: SpotifyArtist) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cleanTarget = artist.name.toLowerCase().replace(/[^a-z0-9]/g, '');

    setSelectedArtists((prev) => {
      const exists = prev.some(
        (a) => a.id === artist.id || a.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget
      );
      if (exists) {
        return prev.filter(
          (a) => a.id !== artist.id && a.name.toLowerCase().replace(/[^a-z0-9]/g, '') !== cleanTarget
        );
      } else {
        return [...prev, { id: artist.id, name: artist.name }];
      }
    });

    setCustomSelectedArtists((prev) => {
      const exists = prev.some(
        (a) => a.id === artist.id || a.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget
      );
      if (exists) {
        return prev.filter(
          (a) => a.id !== artist.id && a.name.toLowerCase().replace(/[^a-z0-9]/g, '') !== cleanTarget
        );
      } else {
        return [artist, ...prev];
      }
    });
  };

  const toggleLanguage = (lang: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const toggleDecade = (dec: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDecades((prev) =>
      prev.includes(dec) ? prev.filter((d) => d !== dec) : [...prev, dec]
    );
  };

  // Next / Back handlers
  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep((s) => s + 1);
    } else {
      handleSave();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep((s) => s - 1);
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      saveMusicPreferences(user.id, {
        favoriteGenres: selectedGenres,
        favoriteArtistIds: selectedArtists.map((a) => a.id),
        favoriteArtistNames: selectedArtists.map((a) => a.name),
        preferredLanguages: selectedLanguages,
        preferredDecades: selectedDecades,
        energyPreference: energyPref,
        instrumentalPreference: instrumentalPref,
        discoveryLevel,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refreshData();
      customAlert('Preferences Saved!', 'Your mood recommendations have been updated.');
      router.back();
    } catch (err) {
      console.error('[Survey] Save failed:', err);
      customAlert('Error', 'Failed to save preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  // Render Step 1: Genres
  const renderStep1Genres = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Pick Your Favorite Genres</Text>
      <Text style={styles.stepSubtitle}>
        Select genres you love. We'll use these to match music to your logged moods.
      </Text>

      {/* Filter input */}
      <View style={styles.searchBar}>
        <Feather name="search" size={16} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search genres (e.g. lo-fi, pop, bollywood)..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={genreSearchQuery}
          onChangeText={setGenreSearchQuery}
          autoCapitalize="none"
        />
        {genreSearchQuery.length > 0 && (
          <Pressable onPress={() => setGenreSearchQuery('')}>
            <Feather name="x" size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.chipCloud}>
        {displayGenres.map((genre) => {
          const isSelected = selectedGenres.includes(genre);
          const isSuggested = suggestedGenres.includes(genre.toLowerCase());
          return (
            <Pressable
              key={genre}
              style={[styles.genreChip, isSelected && styles.genreChipSelected]}
              onPress={() => toggleGenre(genre)}
            >
              {isSuggested && !isSelected && (
                <View style={styles.suggestedDot} />
              )}
              {isSelected && (
                <Feather name="check" size={12} color="#0A0A0C" style={{ marginRight: 4 }} />
              )}
              <Text style={[styles.genreChipText, isSelected && styles.genreChipTextSelected]}>
                {genre}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  // Render Step 2: Artists
  const renderStep2Artists = () => {
    const query = artistSearchQuery.trim().toLowerCase();

    // Base combined seed list (Custom selected searched artists + User's top Spotify artists + popular seed artists)
    const baseSeeds = dedupeArtists([...customSelectedArtists, ...topArtists, ...POPULAR_SEED_ARTISTS]);

    // Instant local filter for zero lag
    const localFiltered = query
      ? baseSeeds.filter((a) => a.name.toLowerCase().includes(query))
      : baseSeeds;

    // Display list: Live Spotify search results first (if query present), then local matches
    const rawList = query
      ? [...artistSearchResults, ...localFiltered]
      : baseSeeds;

    const displayList = dedupeArtists(rawList);

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Choose Artists You Like</Text>
        <Text style={styles.stepSubtitle}>
          Suggested based on your Spotify listening, or search any artist below.
        </Text>

        <View style={styles.searchBar}>
          <Feather name="search" size={16} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search any artist on Spotify..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={artistSearchQuery}
            onChangeText={setArtistSearchQuery}
            autoCapitalize="none"
          />
          {isSearchingArtists && <ActivityIndicator size="small" color={Colors.accent.primary} />}
          {artistSearchQuery.length > 0 && !isSearchingArtists && (
            <Pressable onPress={() => setArtistSearchQuery('')}>
              <Feather name="x" size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>
          )}
        </View>

        {/* Selected Artists Section */}
        {selectedArtists.length > 0 && (
          <View style={styles.selectedArtistSection}>
            <View style={styles.selectedHeaderRow}>
              <Text style={styles.selectedCountText}>
                Selected ({selectedArtists.length})
              </Text>
              <Pressable onPress={() => { setSelectedArtists([]); setCustomSelectedArtists([]); }} hitSlop={8}>
                <Text style={styles.clearAllText}>Clear all</Text>
              </Pressable>
            </View>

            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={styles.selectedArtistScroll}
              contentContainerStyle={styles.selectedArtistWrapCloud}
            >
              {selectedArtists.map((a) => (
                <View key={a.id} style={styles.selectedArtistPill}>
                  <Text style={styles.selectedArtistPillText} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setSelectedArtists((prev) => prev.filter((item) => item.id !== a.id))
                    }
                    hitSlop={8}
                    style={styles.pillCloseBtn}
                  >
                    <Feather name="x" size={10} color="#0A0A0C" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.artistGrid}>
          {displayList.length === 0 ? (
            <View style={styles.emptyArtistSearch}>
              <Feather name="disc" size={32} color={Colors.text.tertiary} />
              <Text style={styles.emptyArtistTitle}>No artists found</Text>
              <Text style={styles.emptyArtistSub}>
                Try searching for another artist name on Spotify
              </Text>
            </View>
          ) : (
            displayList.map((artist) => {
              const cleanTarget = artist.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              const isSelected = selectedArtists.some(
                (a) => a.id === artist.id || a.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget
              );
              const imgUrl = artist.images?.find((i) => !!i?.url)?.url;
              const firstLetter = artist.name ? artist.name.charAt(0).toUpperCase() : '?';

              return (
                <Pressable
                  key={artist.id || artist.name}
                  style={[styles.artistCard, isSelected && styles.artistCardSelected]}
                  onPress={() => toggleArtist(artist)}
                >
                  <View style={styles.artistAvatarWrap}>
                    <View style={styles.artistAvatarImgContainer}>
                      {imgUrl ? (
                        <Image
                          source={{ uri: imgUrl }}
                          style={styles.artistAvatar}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <View style={styles.artistAvatarFallback}>
                          <Text style={styles.avatarInitialText}>{firstLetter}</Text>
                        </View>
                      )}
                    </View>
                    {isSelected && (
                      <View style={styles.artistCheckBadge}>
                        <Feather name="check" size={11} color="#0A0A0C" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.artistName} numberOfLines={1}>
                    {artist.name}
                  </Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  // Render Step 3: Languages & Decades
  const renderStep3LanguageDecades = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Languages & Decades</Text>
      <Text style={styles.stepSubtitle}>
        Tailor music language and time periods for personalized mood tracks.
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Preferred Languages</Text>
        <View style={styles.chipCloud}>
          {MUSIC_LANGUAGES.map((lang) => {
            const isSelected = selectedLanguages.includes(lang);
            return (
              <Pressable
                key={lang}
                style={[styles.genreChip, isSelected && styles.genreChipSelected]}
                onPress={() => toggleLanguage(lang)}
              >
                {isSelected && (
                  <Feather name="check" size={12} color="#0A0A0C" style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.genreChipText, isSelected && styles.genreChipTextSelected]}>
                  {lang}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>Preferred Decades</Text>
        <View style={styles.chipCloud}>
          {DECADE_OPTIONS.map((dec) => {
            const isSelected = selectedDecades.includes(dec);
            return (
              <Pressable
                key={dec}
                style={[styles.genreChip, isSelected && styles.genreChipSelected]}
                onPress={() => toggleDecade(dec)}
              >
                {isSelected && (
                  <Feather name="check" size={12} color="#0A0A0C" style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.genreChipText, isSelected && styles.genreChipTextSelected]}>
                  {dec}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  // Render Step 4: Listening Style
  const renderStep4Style = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Listening Preferences</Text>
      <Text style={styles.stepSubtitle}>
        Fine-tune how energy, vocals, and discovery influence recommendations.
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xl }}>
        {/* Discovery Level */}
        <GlassCard intensity="medium" padding="lg">
          <Text style={styles.cardSectionTitle}>Discovery Level</Text>
          <Text style={styles.cardSectionDesc}>How much new music should we recommend?</Text>

          <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
            {[
              { id: 'familiar', title: 'Familiar Favorites', desc: 'Mostly artists you already know' },
              { id: 'balanced', title: 'Balanced Mix', desc: 'A healthy mix of comfort and discovery' },
              { id: 'adventurous', title: 'Adventurous', desc: 'Surprise me with fresh new artists' },
            ].map((option) => {
              const isSelected = discoveryLevel === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={[styles.optionPill, isSelected && styles.optionPillSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDiscoveryLevel(option.id as any);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                      {option.title}
                    </Text>
                    <Text style={styles.optionDesc}>{option.desc}</Text>
                  </View>
                  {isSelected && <Feather name="check-circle" size={18} color={Colors.accent.primary} />}
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        {/* Energy Preference */}
        <GlassCard intensity="medium" padding="lg">
          <Text style={styles.cardSectionTitle}>Energy Preference</Text>
          <View style={styles.segmentedRow}>
            {['any', 'low', 'medium', 'high'].map((val) => {
              const isSelected = energyPref === val;
              return (
                <Pressable
                  key={val}
                  style={[styles.segmentBtn, isSelected && styles.segmentBtnSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEnergyPref(val as any);
                  }}
                >
                  <Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>
                    {val.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        {/* Vocals vs Instrumental */}
        <GlassCard intensity="medium" padding="lg">
          <Text style={styles.cardSectionTitle}>Vocals vs Instrumental</Text>
          <View style={styles.segmentedRow}>
            {['any', 'vocals', 'instrumental'].map((val) => {
              const isSelected = instrumentalPref === val;
              return (
                <Pressable
                  key={val}
                  style={[styles.segmentBtn, isSelected && styles.segmentBtnSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setInstrumentalPref(val as any);
                  }}
                >
                  <Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>
                    {val.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );

  return (
    <GradientBackground>
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} hitSlop={12} style={styles.iconBtn}>
            <Feather name="chevron-left" size={24} color={Colors.text.primary} />
          </Pressable>

          <View style={styles.stepProgressContainer}>
            <Text style={styles.stepProgressText}>
              Step {step} of {TOTAL_STEPS}
            </Text>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
            </View>
          </View>

          <Pressable onPress={handleSave} hitSlop={12}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        {/* Body Content */}
        {loadingInitial ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color={Colors.accent.primary} />
            <Text style={styles.loadingText}>Connecting with Spotify catalog...</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {step === 1 && renderStep1Genres()}
            {step === 2 && renderStep2Artists()}
            {step === 3 && renderStep3LanguageDecades()}
            {step === 4 && renderStep4Style()}
          </View>
        )}

        {/* Footer Navigation Button */}
        <View style={[styles.footerBar, { paddingBottom: insets.bottom + Spacing.md }]}>
          <Button
            title={step === TOTAL_STEPS ? (isSaving ? 'Saving...' : 'Finish & Save Taste') : 'Continue'}
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleNext}
            disabled={isSaving}
          />
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepProgressContainer: {
    alignItems: 'center',
    gap: 4,
  },
  stepProgressText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
  progressBarTrack: {
    width: 100,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.accent.primary,
  },
  skipText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.secondary,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.md,
    height: 44,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
  },
  chipCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  genreChipSelected: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
  },
  genreChipText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.primary,
  },
  genreChipTextSelected: {
    color: '#0A0A0C',
    fontFamily: Fonts.bodySemiBold,
  },
  suggestedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.primary,
    marginRight: 6,
  },
  selectedArtistSection: {
    marginBottom: Spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  selectedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  selectedCountText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.accent.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearAllText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
  },
  selectedArtistScroll: {
    maxHeight: 110,
  },
  selectedArtistWrapCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedArtistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  selectedArtistPillText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: '#0A0A0C',
    marginRight: 6,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  pillCloseBtn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyArtistSearch: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyArtistTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    marginTop: Spacing.xs,
  },
  emptyArtistSub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  artistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  artistCard: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md * 2) / 3,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  artistCardSelected: {
    borderColor: Colors.accent.primary,
    backgroundColor: 'rgba(190, 255, 108, 0.08)',
  },
  artistAvatarWrap: {
    position: 'relative',
    width: 64,
    height: 64,
    marginBottom: Spacing.xs,
  },
  artistAvatarImgContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  artistAvatar: {
    width: '100%',
    height: '100%',
  },
  artistAvatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(190, 255, 108, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(190, 255, 108, 0.3)',
  },
  avatarInitialText: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    color: Colors.accent.primary,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  artistCheckBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0A0A0C',
    zIndex: 10,
    elevation: 5,
  },
  artistName: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: Colors.text.primary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  sectionLabel: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  cardSectionTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
  },
  cardSectionDesc: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  optionPillSelected: {
    borderColor: Colors.accent.primary,
    backgroundColor: 'rgba(190, 255, 108, 0.08)',
  },
  optionTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },
  optionTitleSelected: {
    color: Colors.accent.primary,
  },
  optionDesc: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 4,
    borderRadius: Radius.pill,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.pill,
  },
  segmentBtnSelected: {
    backgroundColor: Colors.accent.primary,
  },
  segmentText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
  },
  segmentTextSelected: {
    color: '#0A0A0C',
  },
  footerBar: {
    paddingTop: Spacing.md,
  },
});
