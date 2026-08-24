/**
 * MoodMap — Letter Unlock Modal
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  Animated,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius } from '@/constants/layout';
import { verifyLetterKeyword, type JournalEntryRow } from '@/services/journalService';

interface LetterUnlockModalProps {
  visible: boolean;
  entry: JournalEntryRow | null;
  onClose: () => void;
  onUnlocked: (entry: JournalEntryRow) => void;
}

export function LetterUnlockModal({
  visible,
  entry,
  onClose,
  onUnlocked,
}: LetterUnlockModalProps) {
  const [keyword, setKeyword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Shake animation for incorrect password
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setKeyword('');
      setErrorMsg(null);
      setShowPassword(false);
      // Auto focus after modal opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 250);
    }
  }, [visible]);

  if (!entry) return null;

  const triggerShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleUnlock = () => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      setErrorMsg('Please enter the secret keyword.');
      triggerShake();
      return;
    }

    const isValid = verifyLetterKeyword(entry, trimmed);
    if (isValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUnlocked(entry);
    } else {
      setErrorMsg('Incorrect secret keyword. Please try again.');
      triggerShake();
    }
  };

  const recipientLabel =
    entry.recipient === 'past_self'
      ? 'Past Self'
      : entry.recipient === 'someone'
        ? entry.recipient_name
          ? `To: ${entry.recipient_name}`
          : 'Someone Special'
        : 'Protected Letter';

  const canSubmit = keyword.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Full screen static dark backdrop */}
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
          style={styles.keyboardAvoid}
          pointerEvents="box-none"
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[
                styles.card,
                { transform: [{ translateX: shakeAnim }] },
              ]}
            >
              {/* Header Icon */}
              <View style={styles.iconCircle}>
                <Feather name="key" size={24} color={Colors.accent.primary} />
              </View>

              {/* Recipient Badge */}
              <View style={styles.recipientBadge}>
                <Feather
                  name={entry.recipient === 'past_self' ? 'heart' : 'user'}
                  size={11}
                  color={Colors.accent.primary}
                />
                <Text style={styles.recipientBadgeText}>{recipientLabel}</Text>
              </View>

              <Text style={styles.title}>Protected Letter</Text>
              <Text style={styles.subtitle}>
                Enter the secret keyword you created to unlock and read this letter.
              </Text>

              {/* Hint Card */}
              {entry.lock_hint && (
                <View style={styles.hintContainer}>
                  <View style={styles.hintHeader}>
                    <Feather name="help-circle" size={12} color={Colors.accent.amber} />
                    <Text style={styles.hintHeaderTitle}>Password Hint</Text>
                  </View>
                  <Text style={styles.hintText}>"{entry.lock_hint}"</Text>
                </View>
              )}

              {/* Keyword Input */}
              <View
                style={[
                  styles.inputWrapper,
                  isFocused && styles.inputWrapperFocused,
                  errorMsg ? styles.inputWrapperError : null,
                ]}
              >
                <Feather
                  name="lock"
                  size={15}
                  color={isFocused ? Colors.accent.primary : Colors.text.tertiary}
                />
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Enter secret keyword..."
                  placeholderTextColor="rgba(255, 255, 255, 0.35)"
                  value={keyword}
                  onChangeText={(t) => {
                    setKeyword(t);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleUnlock}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() => setShowPassword((p) => !p)}
                  style={styles.eyeBtn}
                >
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={15}
                    color={Colors.text.secondary}
                  />
                </Pressable>
              </View>

              {/* Error Message */}
              {errorMsg && (
                <View style={styles.errorRow}>
                  <Feather name="alert-circle" size={12} color={Colors.accent.coral} />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              )}

              {/* Actions */}
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.unlockBtn,
                    !canSubmit && styles.unlockBtnDisabled,
                  ]}
                  onPress={handleUnlock}
                  disabled={!canSubmit}
                >
                  <Feather
                    name="unlock"
                    size={14}
                    color={canSubmit ? Colors.text.onAccent : 'rgba(190, 255, 108, 0.4)'}
                  />
                  <Text
                    style={[
                      styles.unlockBtnText,
                      !canSubmit && styles.unlockBtnTextDisabled,
                    ]}
                  >
                    Unlock & Open
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#16161B',
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(190, 255, 108, 0.25)',
  },
  recipientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  recipientBadgeText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny - 0.5,
    color: 'rgba(255, 255, 255, 0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  hintContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 190, 106, 0.08)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 190, 106, 0.2)',
  },
  hintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  hintHeaderTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny - 1,
    color: Colors.accent.amber,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hintText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  inputWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F0F14',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: Spacing.sm,
  },
  inputWrapperFocused: {
    borderColor: Colors.accent.primary,
  },
  inputWrapperError: {
    borderColor: Colors.accent.coral,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.primary,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: Spacing.sm,
    alignSelf: 'flex-start',
  },
  errorText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.tiny,
    color: Colors.accent.coral,
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
  },
  unlockBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent.primary,
  },
  unlockBtnDisabled: {
    backgroundColor: 'rgba(190, 255, 108, 0.15)',
  },
  unlockBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.onAccent,
  },
  unlockBtnTextDisabled: {
    color: 'rgba(190, 255, 108, 0.4)',
  },
});
