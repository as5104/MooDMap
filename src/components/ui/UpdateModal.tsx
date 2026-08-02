import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { GlassCard } from './GlassCard';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Radius, Spacing } from '@/constants/layout';
import { AppVersionInfo, downloadAndInstallUpdate } from '@/services/updateService';

interface UpdateModalProps {
  visible: boolean;
  updateInfo: AppVersionInfo | null;
  onDismiss: () => void;
}

export function UpdateModal({ visible, updateInfo, onDismiss }: UpdateModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  if (!updateInfo || !visible) return null;

  const handleUpdate = async () => {
    if (!updateInfo.downloadUrl || isDownloading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsDownloading(true);
    setDownloadProgress(0.05);

    const success = await downloadAndInstallUpdate(
      updateInfo.downloadUrl,
      (progress) => {
        setDownloadProgress(progress);
      }
    );

    setIsDownloading(false);
    if (success) {
      onDismiss();
    }
  };

  const progressPercent = Math.round(downloadProgress * 100);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={isDownloading ? undefined : onDismiss}
    >
      <View style={styles.overlay}>
        <GlassCard intensity="strong" padding="lg" style={styles.modalCard}>
          {/* Top Icon Badge */}
          <View style={styles.iconBadge}>
            <Feather name="arrow-up-circle" size={32} color="#8DE91D" />
          </View>

          {/* Title & Version Info */}
          <Text style={styles.title}>New Update Available</Text>
          <Text style={styles.versionBadgeText}>
            Version {updateInfo.latestVersion} (Current: v{updateInfo.currentVersion})
          </Text>

          {/* Release Notes */}
          <View style={styles.notesBox}>
            <View style={styles.notesHeaderRow}>
              <Feather name="file-text" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.notesHeader}>What&apos;s New</Text>
            </View>
            <Text style={styles.notesText} numberOfLines={4}>
              {updateInfo.releaseNotes || 'Includes performance updates, bug fixes, and user experience enhancements.'}
            </Text>
          </View>

          {/* Download Progress Bar when downloading */}
          {isDownloading ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressTextRow}>
                <Text style={styles.progressLabel}>
                  {progressPercent >= 100 ? 'Opening Package Installer...' : `Downloading... ${progressPercent}%`}
                </Text>
                <ActivityIndicator size="small" color="#8DE91D" />
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(Math.max(progressPercent, 5), 100)}%` },
                  ]}
                />
              </View>
            </View>
          ) : (
            /* Actions */
            <View style={styles.buttonRow}>
              <Pressable style={styles.laterBtn} onPress={onDismiss}>
                <Text style={styles.laterText}>Later</Text>
              </Pressable>

              <Pressable style={styles.updateBtn} onPress={handleUpdate}>
                <Feather name="download" size={16} color="#000000" />
                <Text style={styles.updateText}>Update Now</Text>
              </Pressable>
            </View>
          )}
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.card,
    alignItems: 'center',
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(141, 233, 29, 0.12)',
    borderColor: 'rgba(141, 233, 29, 0.25)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  versionBadgeText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: '#8DE91D',
    marginBottom: Spacing.md,
  },
  notesBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  notesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  notesHeader: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.tiny,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  progressContainer: {
    width: '100%',
    marginTop: Spacing.xs,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  progressLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.bodySmall,
    color: '#8DE91D',
  },
  progressBarTrack: {
    height: 8,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8DE91D',
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
  },
  laterBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption + 1,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  updateBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: '#8DE91D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  updateText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption + 1,
    color: '#000000',
  },
});
