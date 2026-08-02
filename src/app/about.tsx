/**
 * MoodMap — About & Updates Screen
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { GlassCard, GradientBackground } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Radius, Spacing } from '@/constants/layout';
import {
  AppVersionInfo,
  checkForAppUpdates,
  getCurrentAppVersion,
  openUpdateDownload,
} from '@/services/updateService';

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const paddingTop = Math.max(insets.top, Spacing.md);

  const currentVersion = getCurrentAppVersion();
  const [isChecking, setIsChecking] = useState(false);
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);

  // Initial update check on screen mount
  const handleCheck = useCallback(async (showHaptic = true) => {
    if (showHaptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsChecking(true);
    try {
      const info = await checkForAppUpdates();
      setVersionInfo(info);
      if (showHaptic) {
        Haptics.notificationAsync(
          info.hasUpdate
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Success
        );
      }
    } catch (err) {
      console.warn('[AboutScreen] Check error:', err);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    handleCheck(false);
  }, [handleCheck]);

  // Hardware Back Handler
  useEffect(() => {
    const onBack = () => {
      router.back();
      return true;
    };
    const handler = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => handler.remove();
  }, [router]);

  return (
    <GradientBackground variant="glow">
      <View style={[styles.container, { paddingTop }]}>
        {/* Navigation Header */}
        <View style={styles.navHeader}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Feather name="chevron-left" size={24} color={Colors.text.primary} />
          </Pressable>

          <View style={styles.navTitleContainer}>
            <Text style={styles.navTitleText}>About & Updates</Text>
            <Text style={styles.navSubtitleText}>System Information</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* App Branding Hero */}
          <GlassCard intensity="strong" padding="lg" style={styles.heroCard}>
            <View style={styles.heroInner}>
              <Image
                source={require('../../assets/images/logo-mark.png')}
                style={styles.heroLogoImage}
                resizeMode="contain"
              />
              <Text style={styles.appName}>MooDMap</Text>
              <Text style={styles.appTagline}>
                Personalized Mood Tracking & Intelligent Music Recommendation System
              </Text>
              <View style={styles.versionChip}>
                <Feather name="shield" size={12} color="#8DE91D" />
                <Text style={styles.versionChipText}>Version {currentVersion}</Text>
              </View>
            </View>
          </GlassCard>

          {/* Update Status Card */}
          <GlassCard intensity="medium" padding="md" style={styles.statusCard}>
            <View style={styles.statusHeaderRow}>
              <View
                style={[
                  styles.statusIconWrap,
                  {
                    backgroundColor: versionInfo?.hasUpdate
                      ? 'rgba(255, 179, 0, 0.15)'
                      : 'rgba(141, 233, 29, 0.15)',
                  },
                ]}
              >
                <Feather
                  name={
                    isChecking
                      ? 'refresh-cw'
                      : versionInfo?.hasUpdate
                      ? 'arrow-up-circle'
                      : 'check-circle'
                  }
                  size={20}
                  color={versionInfo?.hasUpdate ? '#FFB300' : '#8DE91D'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>
                  {isChecking
                    ? 'Checking for updates...'
                    : versionInfo?.hasUpdate
                    ? `Update Available (v${versionInfo.latestVersion})`
                    : 'MooDMap is Up to Date'}
                </Text>
                <Text style={styles.statusSubtitle}>
                  {isChecking
                    ? 'Connecting to release server...'
                    : versionInfo?.hasUpdate
                    ? 'A new build with features and bug fixes is ready.'
                    : `Installed: v${currentVersion} • Latest: v${versionInfo?.latestVersion || currentVersion}`}
                </Text>
              </View>
            </View>

            {/* Check / Update Button */}
            {versionInfo?.hasUpdate ? (
              <Pressable
                style={styles.updateActionBtn}
                onPress={() => openUpdateDownload(versionInfo.downloadUrl)}
              >
                <Feather name="download" size={16} color="#000000" />
                <Text style={styles.updateActionText}>Download Latest Update</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.checkBtn, isChecking && styles.btnDisabled]}
                onPress={() => handleCheck(true)}
                disabled={isChecking}
              >
                {isChecking ? (
                  <ActivityIndicator size="small" color={Colors.text.primary} />
                ) : (
                  <>
                    <Feather name="refresh-cw" size={14} color={Colors.text.primary} />
                    <Text style={styles.checkBtnText}>Check for Updates</Text>
                  </>
                )}
              </Pressable>
            )}
          </GlassCard>

          {/* Release Notes / Details */}
          {versionInfo?.releaseNotes ? (
            <GlassCard intensity="subtle" padding="md" style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Feather name="file-text" size={16} color={Colors.accent.primary} />
                <Text style={styles.sectionTitle}>Release Information</Text>
              </View>
              <Text style={styles.notesText}>{versionInfo.releaseNotes}</Text>
            </GlassCard>
          ) : null}

          {/* Application Metadata Grid */}
          <GlassCard intensity="subtle" padding="none" style={styles.sectionCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Feather name="cpu" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.infoLabel}>Build Framework</Text>
              </View>
              <Text style={styles.infoValue}>Expo SDK 56 (React Native)</Text>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Feather name="database" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.infoLabel}>Database Engine</Text>
              </View>
              <Text style={styles.infoValue}>SQLite + Supabase Cloud</Text>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoLabelGroup}>
                <Feather name="lock" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.infoLabel}>Auth Storage</Text>
              </View>
              <Text style={styles.infoValue}>Expo SecureStore</Text>
            </View>
          </GlassCard>

          {/* Developer & Support Footer */}
          <View style={styles.footerContainer}>
            <Text style={styles.copyrightText}>
              MooDMap © {new Date().getFullYear()} • All rights reserved
            </Text>
            <Text style={styles.developerText}>
              Crafted with precision for wellness by as5104.
            </Text>
          </View>
        </ScrollView>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleContainer: {
    alignItems: 'center',
  },
  navTitleText: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body,
    color: Colors.text.primary,
  },
  navSubtitleText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255,255,255,0.5)',
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl + 20,
  },
  heroCard: {
    borderRadius: Radius.card,
    marginBottom: Spacing.md,
  },
  heroInner: {
    alignItems: 'center',
    textAlign: 'center',
  },
  heroLogoImage: {
    width: 68,
    height: 68,
    marginBottom: Spacing.sm,
  },
  appName: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h2,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  appTagline: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  versionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(141, 233, 29, 0.12)',
    borderColor: 'rgba(141, 233, 29, 0.25)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  versionChipText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny,
    color: '#8DE91D',
  },
  statusCard: {
    borderRadius: Radius.card,
    marginBottom: Spacing.md,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.caption + 2,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  statusSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 16,
  },
  checkBtn: {
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  checkBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption,
    color: Colors.text.primary,
  },
  updateActionBtn: {
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: '#8DE91D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  updateActionText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption + 1,
    color: '#000000',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  sectionCard: {
    borderRadius: Radius.card,
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.caption + 2,
    color: Colors.text.primary,
  },
  notesText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
  },
  infoLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  infoLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255,255,255,0.8)',
  },
  infoValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption,
    color: Colors.text.primary,
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  copyrightText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 2,
  },
  developerText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny - 1,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
});
