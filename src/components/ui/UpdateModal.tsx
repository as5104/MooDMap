/**
 * MoodMap — Update Modal Component
 */

import React from 'react';
import {
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
import { AppVersionInfo, openUpdateDownload } from '@/services/updateService';

interface UpdateModalProps {
  visible: boolean;
  updateInfo: AppVersionInfo | null;
  onDismiss: () => void;
}

export function UpdateModal({ visible, updateInfo, onDismiss }: UpdateModalProps) {
  if (!updateInfo || !visible) return null;

  const handleUpdate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openUpdateDownload(updateInfo.downloadUrl);
    onDismiss();
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onDismiss}
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

          {/* Actions */}
          <View style={styles.buttonRow}>
            <Pressable style={styles.laterBtn} onPress={onDismiss}>
              <Text style={styles.laterText}>Later</Text>
            </Pressable>

            <Pressable style={styles.updateBtn} onPress={handleUpdate}>
              <Feather name="download" size={16} color="#000000" />
              <Text style={styles.updateText}>Update Now</Text>
            </Pressable>
          </View>
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
