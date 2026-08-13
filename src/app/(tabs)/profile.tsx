/**
 * MoodMap — Profile Screen
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GradientBackground, GlassCard, Button, customAlert } from '@/components/ui';
import { GlobalQuickMusicWidget } from '@/components/music/GlobalQuickMusicWidget';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/layout';
import { useAppStore } from '@/stores/appStore';
import { useTierStore } from '@/stores/tierStore';
import { useSpotify } from '@/hooks/useSpotify';
import { signOut, updateUserProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getMoodScoreForPeriod, getMoodCountForPeriod, getMoodStreak, getMoodCount } from '@/services/moodService';
import { getJournalCount } from '@/services/journalService';
import { exportUserData, importUserData } from '@/services/dataTransferService';
import { getSetting, saveSetting } from '@/services/settingsService';
import { getPreferenceSummary, hasMusicPreferences } from '@/services/musicPreferenceService';
import { pickAndValidateAvatar, saveCustomAvatar, getCustomAvatarUri, clearCustomAvatar } from '@/services/profileService';


// XP thresholds per level
const XP_PER_LEVEL = 500;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const totalXP = useAppStore((s) => s.totalXP);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const isAppReady = useAppStore((s) => s.isAppReady);
  const displayName = user?.user_metadata?.display_name
    ?? user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? 'User';
  const firstName = displayName.split(' ')[0];
  const avatarUrl: string | undefined = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture;
  const email = user?.email ?? '';

  const [journalCount, setJournalCount] = useState(0);
  const [moodCount, setMoodCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [biometricLockEnabled, setBiometricLockEnabled] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [prefSummary, setPrefSummary] = useState<string>('');
  const [hasPrefs, setHasPrefs] = useState<boolean>(false);

  // Profile edit state
  const avatarVersion = useAppStore((s) => s.avatarVersion);
  const customAvatarPath = getCustomAvatarUri();
  const customAvatarUri = customAvatarPath ? `${customAvatarPath}?v=${avatarVersion}` : undefined;

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(firstName);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Pending avatar edits inside modal (preview only, not saved to disk until Save is pressed)
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | undefined>(undefined);
  const [pendingAvatarAction, setPendingAvatarAction] = useState<'set' | 'remove' | null>(null);

  // Effective avatar for main screen: custom upload > Google > initial
  const effectiveAvatarUrl = customAvatarUri || avatarUrl;

  // Effective avatar for edit modal preview
  const modalPreviewAvatarUrl =
    pendingAvatarAction === 'set'
      ? pendingAvatarUri
      : pendingAvatarAction === 'remove'
      ? avatarUrl
      : effectiveAvatarUrl;

  const refreshData = useAppStore((s) => s.refreshData);

  // VIP & Spotify
  const isVIP = useTierStore((s) => s.isVIP);
  const vipStatus = useTierStore((s) => s.vipStatus);
  const requestVIPAccess = useTierStore((s) => s.requestVIPAccess);
  const checkVIPStatus = useTierStore((s) => s.checkVIPStatus);
  const deactivateVIP = useTierStore((s) => s.deactivateVIP);
  const {
    isConnected: spotifyConnected,
    spotifyUser,
    connect: connectSpotify,
    disconnect: disconnectSpotify,
    isConnecting,
    refreshSession: refreshSpotifySession,
  } = useSpotify();

  const [requesting, setRequesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isRefreshingSpotify, setIsRefreshingSpotify] = useState(false);

  const handleSyncSpotifySession = useCallback(async () => {
    setIsRefreshingSpotify(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await refreshSpotifySession();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      customAlert('Spotify Synced', 'Your Spotify session, playlists, and current playback state have been refreshed successfully.');
    } catch (e) {
      customAlert('Sync Failed', 'Could not refresh Spotify session. Please check your connection.');
    } finally {
      setIsRefreshingSpotify(false);
    }
  }, [refreshSpotifySession]);
  const successScale = useSharedValue(1);

  const successStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
  }));

  const handleRequestAccess = useCallback(async () => {
    if (!user?.id) return;
    setRequesting(true);
    const success = await requestVIPAccess(user.id, user.email || '');
    setRequesting(false);
    if (success) {
      customAlert('Request Submitted', 'Your request has been sent to the developer.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      customAlert('Submission Failed', 'Please check your connection and try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [user?.id, user?.email, requestVIPAccess]);

  const handleCheckStatus = useCallback(async () => {
    if (!user?.id) return;
    setChecking(true);
    await checkVIPStatus(user.id);
    setChecking(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [user?.id, checkVIPStatus]);

  const handleVIPDeactivation = useCallback(() => {
    customAlert('Deactivate VIP', 'This will disconnect Spotify and remove VIP access. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          await deactivateVIP();
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }, [deactivateVIP]);

  const loadData = useCallback(() => {
    if (!isAppReady) return;
    try {
      const userId = user?.id;
      const jCount = getJournalCount(userId);
      const mCount = getMoodCount(userId);
      const streakData = getMoodStreak(userId);
      // Auto-detect best period: prefer 7D, escalate if no data in that window
      const PERIOD_OPTIONS = [7, 30, 90, 365];
      let bestDays = 7;
      for (const days of PERIOD_OPTIONS) {
        if (getMoodCountForPeriod(userId, days) > 0) {
          bestDays = days;
          break;
        }
      }
      const scoreVal = getMoodScoreForPeriod(userId, bestDays);

      setJournalCount(jCount);
      setMoodCount(mCount);
      setStreak(streakData.current);
      setScore(scoreVal);

      // Load settings
      const notifSetting = getSetting('notifications_enabled', 'disabled');
      const bioSetting = getSetting('biometric_lock_enabled', 'disabled');
      const backupDate = getSetting('last_backup_date', '');
      setNotificationsEnabled(notifSetting === 'enabled');
      setBiometricLockEnabled(bioSetting === 'enabled');
      setLastBackupDate(backupDate || null);

      // Check VIP status & preferences asynchronously
      if (userId) {
        checkVIPStatus(userId);
        setHasPrefs(hasMusicPreferences(userId));
        setPrefSummary(getPreferenceSummary(userId));
      }

      // Dynamically calculate and update total XP in store
      const computedXP = (mCount * 25) + (jCount * 15);
      useAppStore.getState().setTotalXP(computedXP);
    } catch (e) {
      console.error('[Profile] Load error:', e);
    }
  }, [user?.id, dataVersion, isAppReady, checkVIPStatus]);

  const handleExport = async () => {
    if (!user?.id) return;
    const success = await exportUserData(user.id);
    if (success) {
      const now = new Date().toISOString();
      saveSetting('last_backup_date', now);
      setLastBackupDate(now);
    }
  };

  const handleImport = async () => {
    if (!user?.id) return;
    const success = await importUserData(user.id);
    if (success) {
      refreshData(); // Trigger UI refresh across all screens
      loadData();     // Refresh profile stats
    }
  };

  const handleBackupToGDrive = async () => {
    await handleExport();
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const currentLevel = Math.floor(totalXP / XP_PER_LEVEL) + 1;
  const xpInLevel = totalXP % XP_PER_LEVEL;
  const xpProgress = xpInLevel / XP_PER_LEVEL;

  const handleLogout = async () => {
    customAlert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            // The auth state listener in _layout.tsx will handle navigation,
            // also navigate explicitly for immediate feedback
            router.replace('/(auth)/login');
          } catch (e) {
            console.error('[Profile] Sign out error:', e);
          }
        },
      },
    ]);
  };

  const handleToggleNotifications = useCallback(async () => {
    const Notifications = require('expo-notifications');
    
    if (notificationsEnabled) {
      // Toggle OFF
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();
        saveSetting('notifications_enabled', 'disabled');
        setNotificationsEnabled(false);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        customAlert('Notifications Disabled', 'Daily mood tracking reminders have been turned off.');
      } catch (err) {
        console.error('[Profile] Cancel notifications error:', err);
      }
    } else {
      // Toggle ON
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          customAlert('Permission Denied', 'Please enable notification permissions in your device settings to receive daily reminders.');
          return;
        }

        // Set channel for Android
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('reminders', {
            name: 'Daily Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#C1FF72',
          });
        }

        // Schedule notification
        // Schedule notification
        await Notifications.cancelAllScheduledNotificationsAsync();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Start your day with MooDMap 🗺️",
            body: "Take a minute to log your morning mood and get your custom recommendations.",
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 8,
            minute: 0,
            channelId: Platform.OS === 'android' ? 'reminders' : undefined,
          },
        });

        saveSetting('notifications_enabled', 'enabled');
        setNotificationsEnabled(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        customAlert('Notifications Enabled', 'Daily reminders scheduled for 8:00 AM.');
      } catch (err) {
        console.error('[Profile] Enable notifications error:', err);
        customAlert('Error', 'Failed to schedule daily reminders.');
      }
    }
  }, [notificationsEnabled]);

  const handleToggleBiometrics = useCallback(async () => {
    const LocalAuthentication = require('expo-local-authentication');

    if (biometricLockEnabled) {
      // Prompt user to authenticate to disable it
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm identity to disable App Lock',
          fallbackLabel: 'Use passcode',
        });
        if (result.success) {
          saveSetting('biometric_lock_enabled', 'disabled');
          setBiometricLockEnabled(false);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          customAlert('App Lock Disabled', 'Biometric App Lock has been disabled.');
        }
      } catch (err) {
        console.error('[Profile] Disable biometric error:', err);
      }
    } else {
      // Toggle ON
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !isEnrolled) {
          customAlert(
            'Biometrics Unavailable',
            'Your device does not support biometrics or has no Face ID/fingerprint enrolled. Please set up security on your device first.'
          );
          return;
        }

        // Verify user can authenticate right now before turning it on
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to enable App Lock',
          fallbackLabel: 'Use passcode',
        });

        if (result.success) {
          saveSetting('biometric_lock_enabled', 'enabled');
          setBiometricLockEnabled(true);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          customAlert('App Lock Enabled', 'The app will now require biometric authentication on startup.');
        }
      } catch (err) {
        console.error('[Profile] Enable biometric error:', err);
        customAlert('Error', 'Failed to set up biometric lock.');
      }
    }
  }, [biometricLockEnabled]);

  // Profile Edit Handlers
  const handleOpenEditModal = useCallback(() => {
    setEditName(firstName);
    setPendingAvatarUri(undefined);
    setPendingAvatarAction(null);
    setShowEditModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [firstName]);

  const handlePickAvatar = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await pickAndValidateAvatar();
    if (result.success && result.tempUri) {
      setPendingAvatarUri(result.tempUri);
      setPendingAvatarAction('set');
    } else if (result.error && result.error !== 'Image selection was canceled.') {
      customAlert('Upload Failed', result.error);
    }
  }, []);

  const handleRemoveAvatar = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPendingAvatarUri(undefined);
    setPendingAvatarAction('remove');
  }, []);

  const handleSaveProfile = useCallback(async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      customAlert('Invalid Name', 'Please enter a valid name.');
      return;
    }
    setIsSavingProfile(true);
    try {
      // 1. Save or remove custom avatar if user modified it in modal
      if (pendingAvatarAction === 'set' && pendingAvatarUri) {
        const saveRes = await saveCustomAvatar(pendingAvatarUri);
        if (saveRes.success && saveRes.uri) {
          useAppStore.getState().bumpAvatarVersion();
        }
      } else if (pendingAvatarAction === 'remove') {
        await clearCustomAvatar();
        useAppStore.getState().bumpAvatarVersion();
      }

      // 2. Update display name in Supabase
      const result = await updateUserProfile({ display_name: trimmed });
      if (result.success) {
        // Refresh user in Zustand store so all screens update
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          useAppStore.getState().setUser(data.user);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowEditModal(false);
      } else {
        customAlert('Update Failed', result.error || 'Could not update profile.');
      }
    } catch (err) {
      customAlert('Error', 'An unexpected error occurred.');
    } finally {
      setIsSavingProfile(false);
    }
  }, [editName, pendingAvatarAction, pendingAvatarUri]);

  const menuItems = [
    {
      icon: 'bell' as const,
      label: 'Notifications',
      value: notificationsEnabled ? 'On' : 'Off',
      onPress: handleToggleNotifications,
    },
    {
      icon: 'shield' as const,
      label: 'App Lock',
      value: biometricLockEnabled ? 'Enabled' : 'Disabled',
      onPress: handleToggleBiometrics,
    },
    {
      icon: 'key' as const,
      label: 'Change Password',
      value: '',
      onPress: () => router.push('/(auth)/forgot-password?mode=change'),
    },
    {
      icon: 'download' as const,
      label: 'Export Data',
      value: '',
      onPress: handleExport,
    },
    {
      icon: 'upload' as const,
      label: 'Import Data',
      value: '',
      onPress: handleImport,
    },
    {
      icon: 'info' as const,
      label: 'About',
      value: `v${require('@/services/updateService').getCurrentAppVersion()}`,
      onPress: () => router.push('/about'),
    },
  ];


  return (
    <GradientBackground>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_MARGIN + Spacing.xxxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl }}>
          <Text style={[styles.title, { marginBottom: 0 }]}>Profile</Text>
          <GlobalQuickMusicWidget inline />
        </View>

        {/* Avatar Card */}
        <GlassCard intensity="medium" padding="lg" style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarContainer}>
              {effectiveAvatarUrl ? (
                <Image
                  source={{ uri: effectiveAvatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {firstName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {/* Edit overlay icon */}
              <Pressable style={styles.editAvatarBtn} onPress={handleOpenEditModal} hitSlop={6}>
                <Feather name="edit-2" size={11} color="#000" />
              </Pressable>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{firstName}</Text>
              <Text style={styles.email}>{email}</Text>
              <View style={styles.memberBadge}>
                <Feather name={isVIP ? "award" : "star"} size={12} color={isVIP ? Colors.accent.amber : Colors.accent.olive} />
                <Text style={styles.memberText}>{isVIP ? 'VIP' : 'Member'}</Text>
              </View>
            </View>
          </View>
        </GlassCard>

        {/* Dashboard Section: Circle Progress & Stats Side-by-Side */}
        <View style={styles.dashboardRow}>
          {/* Left Card: Ring for Mood Level / XP Progress */}
          <GlassCard intensity="medium" padding="md" style={styles.leftDashboardCard}>
            <View style={styles.circleContainer}>
              <Svg width={110} height={110} viewBox="0 0 100 100">
                {/* Thin dark track circle */}
                <Circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="6.5"
                  fill="none"
                />
                {/* Glowing border underlay */}
                <Circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke={Colors.accent.primary}
                  strokeWidth="11"
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - Math.max(xpProgress, 0.02))}`}
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.12"
                  transform="rotate(-90 50 50)"
                />
                {/* Main progress arc */}
                <Circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke={Colors.accent.primary}
                  strokeWidth="6.5"
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - Math.max(xpProgress, 0.02))}`}
                  strokeLinecap="round"
                  fill="none"
                  transform="rotate(-90 50 50)"
                />
              </Svg>
              {/* Inner Text content overlay */}
              <View style={styles.circleTextOverlay}>
                <Text style={styles.circleLevelLabel}>Lvl</Text>
                <Text style={styles.circleLevelValue}>{currentLevel}</Text>
                <Text style={styles.circleXPText}>
                  {xpInLevel}/{XP_PER_LEVEL}
                </Text>
              </View>
            </View>
            <Text style={styles.circleCardFooter} numberOfLines={1}>
              {moodCount} total entries
            </Text>
          </GlassCard>

          {/* Right Card: Score, Journals & Streak */}
          <GlassCard intensity="medium" padding="md" style={styles.rightDashboardCard}>
            {/* Top half: Mood Score */}
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreValue}>{score || '—'}</Text>
              <Text style={styles.scoreLabel}>Mood Score</Text>
            </View>

            {/* Separator */}
            <View style={styles.cardDivider} />

            {/* Bottom half: Journal & Streak side-by-side */}
            <View style={styles.bottomStatsRow}>
              <View style={styles.bottomStatItem}>
                <Text style={styles.bottomStatValue}>{journalCount}</Text>
                <Text style={styles.bottomStatLabel}>Journals</Text>
              </View>
              <View style={styles.bottomStatDivider} />
              <View style={styles.bottomStatItem}>
                <Text style={styles.bottomStatValue}>{streak}</Text>
                <Text style={styles.bottomStatLabel}>Streak</Text>
              </View>
            </View>
          </GlassCard>
        </View>

        {/* Backup to Google Drive Card */}
        <Pressable onPress={handleBackupToGDrive}>
          <GlassCard intensity="medium" padding="lg" style={styles.backupCard}>
            <View style={styles.backupRow}>
              <View style={styles.backupIconWrap}>
                <Feather name="hard-drive" size={22} color={Colors.accent.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.backupTitleRow}>
                  <Text style={styles.backupTitle}>Backup Data</Text>
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>Recommended</Text>
                  </View>
                </View>
                <Text style={styles.backupDesc}>
                  Save to Google Drive
                </Text>
                <Text style={styles.backupLastDate}>
                  {lastBackupDate
                    ? `Last backup: ${new Date(lastBackupDate).toLocaleDateString()}`
                    : 'Never backed up'}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.text.tertiary} />
            </View>
          </GlassCard>
        </Pressable>

        {/* Menu */}
        <GlassCard intensity="subtle" padding="none" style={styles.menuCard}>
          {menuItems.map((item, i) => (
            <Pressable
              key={item.label}
              style={[styles.menuItem, i < menuItems.length - 1 && styles.menuDivider]}
              onPress={item.onPress}
            >
              <Feather name={item.icon} size={20} color={Colors.accent.olive} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuValue}>{item.value}</Text>
              <Feather name="chevron-right" size={16} color={Colors.text.tertiary} />
            </Pressable>
          ))}
        </GlassCard>

        {/* VIP ACCESS SECTION */}
        <View style={styles.vipSection}>
          <View style={styles.vipSectionHeader}>
            <Feather name="award" size={16} color={Colors.accent.amber} />
            <Text style={styles.vipSectionTitle}>VIP Access</Text>
          </View>

          {!isVIP ? (
            /* Locked State */
            <GlassCard intensity="medium" padding="lg" style={styles.vipLockedCard}>
              {/* Ambient glow */}
              <View style={styles.vipGlowOrb} />

              <View style={styles.vipLockedHeader}>
                <View style={styles.vipLockIconWrap}>
                  <Feather
                    name={vipStatus === 'pending' ? 'clock' : vipStatus === 'declined' ? 'alert-circle' : 'lock'}
                    size={22}
                    color={vipStatus === 'declined' ? Colors.accent.coral : Colors.accent.amber}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vipLockedTitle}>
                    {vipStatus === 'pending' ? 'VIP Request Pending' : vipStatus === 'declined' ? 'Request Declined' : 'Unlock VIP Features'}
                  </Text>
                  <Text style={styles.vipLockedDesc}>
                    {vipStatus === 'pending'
                      ? 'Your access request is currently awaiting developer approval.'
                      : vipStatus === 'declined'
                      ? 'Your request was declined. Please contact support.'
                      : 'Connect Spotify, mood-music insights, and more.'}
                  </Text>
                </View>
              </View>

              {vipStatus === 'pending' ? (
                <View style={{ gap: Spacing.sm }}>
                  <Pressable
                    style={styles.vipCheckStatusBtn}
                    onPress={handleCheckStatus}
                    disabled={checking}
                  >
                    {checking ? (
                      <ActivityIndicator size="small" color="#0A0A0C" />
                    ) : (
                      <>
                        <Feather name="refresh-cw" size={14} color="#0A0A0C" />
                        <Text style={styles.vipCheckStatusText}>Check Approval Status</Text>
                      </>
                    )}
                  </Pressable>
                  <Text style={styles.vipWaitHint}>
                    Approval typically takes less than 24 hours.
                  </Text>
                </View>
              ) : (
                <View>
                  <Pressable
                    style={[styles.vipRequestBtn, requesting && styles.vipRequestBtnDisabled]}
                    onPress={handleRequestAccess}
                    disabled={requesting}
                  >
                    {requesting ? (
                      <ActivityIndicator size="small" color="#0A0A0C" />
                    ) : (
                      <>
                        <Feather name="send" size={14} color="#0A0A0C" />
                        <Text style={styles.vipRequestText}>Request VIP Access</Text>
                      </>
                    )}
                  </Pressable>
                  <Text style={styles.vipHintText}>
                    Tapping will send an access request directly to the developer.
                  </Text>
                </View>
              )}
            </GlassCard>
          ) : (
            /* Unlocked State */
            <Animated.View style={successStyle}>
              <GlassCard intensity="medium" padding="lg" style={styles.vipUnlockedCard}>
                {/* Ambient glow */}
                <View style={styles.vipGlowOrbActive} />

                {/* VIP Active Badge */}
                <View style={styles.vipActiveBadge}>
                  <Feather name="check-circle" size={16} color={Colors.accent.primary} />
                  <Text style={styles.vipActiveText}>VIP Active</Text>
                </View>

                {/* Spotify Connection */}
                <View style={styles.spotifySection}>
                  <View style={styles.spotifyHeader}>
                    <View style={styles.spotifyIconWrap}>
                      <Feather name="music" size={18} color="#1DB954" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.spotifyTitle}>Spotify</Text>
                      <Text style={styles.spotifyStatus}>
                        {spotifyConnected
                          ? spotifyUser?.display_name
                            ? `Connected as ${spotifyUser.display_name}`
                            : 'Connected'
                          : 'Not connected'}
                      </Text>
                    </View>
                    {spotifyConnected ? (
                      <View style={styles.spotifyConnectedDot} />
                    ) : null}
                  </View>

                  {spotifyConnected ? (
                    <View style={styles.spotifyActionsRow}>
                      <Pressable
                        style={[styles.spotifySyncBtn, isRefreshingSpotify && { opacity: 0.7 }]}
                        onPress={handleSyncSpotifySession}
                        disabled={isRefreshingSpotify}
                      >
                        {isRefreshingSpotify ? (
                          <ActivityIndicator size="small" color={Colors.accent.olive} />
                        ) : (
                          <>
                            <Feather name="refresh-cw" size={14} color={Colors.accent.olive} />
                            <Text style={styles.spotifySyncText}>Sync Session</Text>
                          </>
                        )}
                      </Pressable>

                      <Pressable
                        style={styles.spotifyDisconnectBtn}
                        onPress={() => {
                          customAlert('Disconnect Spotify', 'Remove Spotify connection?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Disconnect', style: 'destructive', onPress: disconnectSpotify },
                          ]);
                        }}
                      >
                        <Feather name="link-2" size={14} color={Colors.text.secondary} />
                        <Text style={styles.spotifyDisconnectText}>Disconnect</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.spotifyConnectBtn}
                      onPress={connectSpotify}
                      disabled={isConnecting}
                    >
                      <Feather name="link" size={14} color={Colors.text.onAccent} />
                      <Text style={styles.spotifyConnectText}>
                        {isConnecting ? 'Connecting...' : 'Connect Spotify'}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Music Preferences Survey Card */}
                {spotifyConnected && (
                  <View style={{ marginTop: Spacing.md, marginBottom: Spacing.md }}>
                    <Pressable
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: Radius.lg,
                        padding: Spacing.lg,
                        borderWidth: 1,
                        borderColor: hasPrefs ? 'rgba(190, 255, 108, 0.3)' : 'rgba(255, 255, 255, 0.12)',
                      }}
                      onPress={() => router.push('/music-preferences')}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: hasPrefs ? 'rgba(190, 255, 108, 0.15)' : 'rgba(255, 190, 106, 0.15)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Feather
                            name={hasPrefs ? 'sliders' : 'disc'}
                            size={20}
                            color={hasPrefs ? Colors.accent.primary : Colors.accent.amber}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: Fonts.subheading, fontSize: FontSizes.body, color: Colors.text.primary }}>
                            {hasPrefs ? 'Music Taste Profile' : 'Set Up Music Taste'}
                          </Text>
                          <Text style={{ fontFamily: Fonts.body, fontSize: FontSizes.caption, color: Colors.text.secondary, marginTop: 2 }}>
                            {hasPrefs ? prefSummary || 'Customized for personalized recommendations' : 'Personalize recommendations based on genres & artists'}
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={Colors.text.tertiary} />
                      </View>
                    </Pressable>
                  </View>
                )}

                {/* Deactivate link */}
                <Pressable style={styles.vipDeactivateRow} onPress={handleVIPDeactivation}>
                  <Feather name="x-circle" size={14} color={Colors.text.tertiary} />
                  <Text style={styles.vipDeactivateText}>Deactivate VIP</Text>
                </Pressable>
              </GlassCard>
            </Animated.View>
          )}
        </View>

        {/* Sign Out */}
        <Button
          title="Sign Out"
          variant="ghost"
          size="md"
          fullWidth
          onPress={handleLogout}
          style={styles.signOutBtn}
        />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={showEditModal}
        onRequestClose={() => !isSavingProfile && setShowEditModal(false)}
      >
        <View style={styles.editOverlay}>
          <GlassCard intensity="strong" padding="lg" style={styles.editModalCard}>
            {/* Header */}
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Edit Profile</Text>
              <Pressable
                onPress={() => !isSavingProfile && setShowEditModal(false)}
                hitSlop={12}
              >
                <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>

            {/* Avatar Preview & Actions */}
            <View style={styles.editAvatarSection}>
              <View style={styles.editAvatarPreview}>
                {modalPreviewAvatarUrl ? (
                  <Image
                    source={{ uri: modalPreviewAvatarUrl }}
                    style={styles.editAvatarImg}
                  />
                ) : (
                  <View style={[styles.avatar, styles.editAvatarFallback]}>
                    <Text style={[styles.avatarText, { fontSize: 28 }]}>
                      {(editName || firstName).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.editAvatarBtnRow}>
                <Pressable style={styles.editPhotoBtn} onPress={handlePickAvatar}>
                  <Feather name="camera" size={14} color={Colors.accent.primary} />
                  <Text style={styles.editPhotoBtnText}>Change Photo</Text>
                </Pressable>
                {(pendingAvatarAction === 'set' || (Boolean(customAvatarUri) && pendingAvatarAction !== 'remove')) && (
                  <Pressable style={styles.editPhotoBtn} onPress={handleRemoveAvatar}>
                    <Feather name="trash-2" size={14} color={Colors.accent.coral} />
                    <Text style={[styles.editPhotoBtnText, { color: Colors.accent.coral }]}>Remove</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.editPhotoHint}>
                JPEG, PNG, or WebP • Max 5 MB
              </Text>
            </View>

            {/* Name Input */}
            <View style={styles.editInputGroup}>
              <Text style={styles.editLabel}>Display Name</Text>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                maxLength={30}
                autoCapitalize="words"
                editable={!isSavingProfile}
              />
            </View>

            {/* Actions */}
            <View style={styles.editBtnRow}>
              <Pressable
                style={styles.editCancelBtn}
                onPress={() => setShowEditModal(false)}
                disabled={isSavingProfile}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.editSaveBtn, isSavingProfile && { opacity: 0.6 }]}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Feather name="check" size={16} color="#000" />
                    <Text style={styles.editSaveText}>Save</Text>
                  </>
                )}
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl },

  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.xxl,
  },

  profileCard: {
    marginBottom: Spacing.xl,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    width: 64,
    height: 64,
    marginRight: Spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent.olive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarText: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.onAccent,
  },
  profileInfo: { flex: 1 },
  name: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  email: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(190, 255, 108, 0.12)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  memberText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    color: Colors.accent.olive,
  },

  dashboardRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    alignItems: 'stretch',
  },
  leftDashboardCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightDashboardCard: {
    flex: 1,
    justifyContent: 'space-between',
  },
  circleContainer: {
    position: 'relative',
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleTextOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleLevelLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  circleLevelValue: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    color: Colors.text.primary,
    lineHeight: 32,
  },
  circleXPText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 9,
    color: Colors.accent.olive,
    lineHeight: 12,
  },
  circleCardFooter: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  scoreValue: {
    fontFamily: Fonts.heading,
    fontSize: 32,
    color: Colors.text.primary,
    lineHeight: 36,
  },
  scoreLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.text.secondary,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: Spacing.sm,
  },
  bottomStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.xs,
  },
  bottomStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  bottomStatValue: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    color: Colors.text.primary,
    lineHeight: 26,
  },
  bottomStatLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  bottomStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Backup Card
  backupCard: {
    marginBottom: Spacing.xl,
    borderColor: 'rgba(190, 255, 108, 0.15)',
    borderWidth: 1,
  },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backupIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(190, 255, 108, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  backupTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },
  recommendedBadge: {
    backgroundColor: 'rgba(190, 255, 108, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  recommendedText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 9,
    color: Colors.accent.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  backupDesc: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  backupLastDate: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255,255,255,0.3)',
  },

  menuCard: {
    marginBottom: Spacing.xxl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  menuDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  menuLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    flex: 1,
  },
  menuValue: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    marginRight: Spacing.sm,
  },

  signOutBtn: {
    marginBottom: Spacing.xxl,
  },

  // VIP Section
  vipSection: {
    marginBottom: Spacing.xxl,
  },
  vipSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  vipSectionTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
  },

  // Locked card
  vipLockedCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 190, 106, 0.15)',
  },
  vipGlowOrb: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 190, 106, 0.08)',
  },
  vipLockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  vipLockIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 190, 106, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipLockedTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },
  vipLockedDesc: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  vipRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.amber,
    borderRadius: Radius.button,
    paddingVertical: 12,
    marginTop: Spacing.xs,
  },
  vipRequestBtnDisabled: {
    opacity: 0.6,
  },
  vipRequestText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.bodySmall,
    color: '#0A0A0C',
  },
  vipCheckStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.button,
    paddingVertical: 12,
    marginTop: Spacing.xs,
  },
  vipCheckStatusText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.bodySmall,
    color: '#0A0A0C',
  },
  vipWaitHint: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: 4,
  },
  vipHintText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.tertiary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },

  // Unlocked card
  vipUnlockedCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(190, 255, 108, 0.15)',
  },
  vipGlowOrbActive: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(190, 255, 108, 0.06)',
  },
  vipActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(190, 255, 108, 0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
    marginBottom: Spacing.lg,
  },
  vipActiveText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.accent.primary,
  },

  // Spotify
  spotifySection: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  spotifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  spotifyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(30, 215, 96, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },
  spotifyStatus: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  spotifyConnectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1DB954',
  },
  spotifyConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#1DB954',
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xl,
  },
  spotifyConnectText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.onAccent,
  },
  spotifyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  spotifySyncBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(193, 255, 114, 0.12)',
    borderColor: 'rgba(193, 255, 114, 0.25)',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },
  spotifySyncText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.accent.olive,
  },
  spotifyDisconnectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },
  spotifyDisconnectText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  vipDeactivateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: Spacing.sm,
  },
  vipDeactivateText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.tertiary,
  },

  // Edit Profile Modal
  editAvatarBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#111D12',
  },
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  editModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.card,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  editTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
  },
  editAvatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  editAvatarPreview: {
    marginBottom: Spacing.md,
  },
  editAvatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  editAvatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  editAvatarBtnRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  editPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  editPhotoBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: Colors.accent.primary,
  },
  editPhotoHint: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 4,
  },
  editInputGroup: {
    marginBottom: Spacing.lg,
  },
  editLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  editInput: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    height: 46,
  },
  editBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  editCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption + 1,
    color: 'rgba(255,255,255,0.7)',
  },
  editSaveBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editSaveText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption + 1,
    color: '#000000',
  },
});
