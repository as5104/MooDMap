/**
 * MoodMap — Forgot Password / Change Password Screen
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  FadeIn,
} from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  GradientBackground,
  Button,
  Input,
  GlassCard,
  AnimatedPressable,
} from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius } from '@/constants/layout';
import {
  resetPassword,
  verifyPasswordResetOTP,
  updatePassword,
} from '@/lib/auth';
import { useAppStore } from '@/stores/appStore';

type Step = 'email' | 'otp' | 'password';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const isChangeMode = params.mode === 'change';
  const loggedInEmail = useAppStore((s) => s.user?.email ?? '');

  const [step, setStep] = useState<Step>(isChangeMode ? 'otp' : 'email');
  const [email, setEmail] = useState(isChangeMode ? loggedInEmail : '');
  const [otpText, setOtpText] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [success, setSuccess] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const shakeAnim = useSharedValue(0);
  const hasAutoSent = useRef(false);

  // Mask the email address to hide details
  const maskEmail = (emailStr: string): string => {
    if (!emailStr) return '';
    const [name, domain] = emailStr.split('@');
    if (!domain) return emailStr;
    if (name.length <= 2) {
      return `${name[0]}*@${domain}`;
    }
    return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
  };

  // Auto-send OTP on mount if in change-password mode
  useEffect(() => {
    if (isChangeMode && loggedInEmail && !hasAutoSent.current) {
      hasAutoSent.current = true;
      handleSendCode(loggedInEmail);
    }
  }, [isChangeMode, loggedInEmail]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const triggerShake = useCallback(() => {
    shakeAnim.value = withSequence(
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [shakeAnim]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  // Step 1: Send Code
  const handleSendCode = async (emailToUse?: string) => {
    const targetEmail = emailToUse ?? email.trim();
    if (!targetEmail) {
      setError('Please enter your email');
      return;
    }
    setError('');
    setLoading(true);

    const result = await resetPassword(targetEmail);
    if (!result.success) {
      setError(result.error ?? 'Failed to send verification code');
      triggerShake();
    } else {
      if (!emailToUse) {
        // Only navigate to OTP step if we're on the email step
        setStep('otp');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setResendTimer(60);
      // Auto focus the hidden input on switching to OTP step
      setTimeout(() => {
        inputRef.current?.focus();
      }, 500);
    }
    setLoading(false);
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (codeOverride?: string) => {
    const code = codeOverride ?? otpText;
    if (code.length !== 8) {
      setError('Please enter the complete 8-digit code');
      triggerShake();
      return;
    }
    setError('');
    setLoading(true);

    const result = await verifyPasswordResetOTP(email.trim(), code);
    if (!result.success) {
      setError(result.error ?? 'Invalid verification code');
      triggerShake();
      setOtpText('');
      inputRef.current?.focus();
    } else {
      setStep('password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setLoading(false);
  };

  // Step 3: Update Password
  const handleUpdatePassword = async () => {
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      triggerShake();
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      triggerShake();
      return;
    }
    setError('');
    setLoading(true);

    const result = await updatePassword(newPassword);
    if (!result.success) {
      setError(result.error ?? 'Failed to update password');
      triggerShake();
    } else {
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setLoading(false);
  };

  // Password Strength
  const getPasswordStrength = (): { label: string; color: string; width: string } => {
    if (!newPassword) return { label: '', color: 'transparent', width: '0%' };
    if (newPassword.length < 6) return { label: 'Weak', color: Colors.error, width: '25%' };
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    const score = [hasUpper, hasLower, hasNumber, hasSpecial, newPassword.length >= 8].filter(Boolean).length;
    if (score <= 2) return { label: 'Weak', color: Colors.error, width: '25%' };
    if (score <= 3) return { label: 'Medium', color: Colors.accent.amber, width: '50%' };
    if (score <= 4) return { label: 'Strong', color: Colors.accent.olive, width: '75%' };
    return { label: 'Very Strong', color: Colors.accent.primary, width: '100%' };
  };

  const strength = getPasswordStrength();

  // Step Indicator
  const stepIndex = step === 'email' ? 0 : step === 'otp' ? 1 : 2;

  // Success Screen
  if (success) {
    return (
      <GradientBackground variant="glow">
        <View style={styles.successContainer}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.successIconWrap}>
            <Feather name="check-circle" size={52} color={Colors.accent.primary} />
          </Animated.View>
          <Animated.Text
            entering={FadeIn.delay(200).duration(400)}
            style={styles.successTitle}
          >
            Password Updated
          </Animated.Text>
          <Animated.Text
            entering={FadeIn.delay(400).duration(400)}
            style={styles.successText}
          >
            Your password has been changed successfully. You can now sign in with your new password.
          </Animated.Text>
          <Animated.View entering={FadeIn.delay(600).duration(400)} style={{ width: '100%', alignItems: 'center' }}>
            <Button
              title={isChangeMode ? 'Back to Profile' : 'Back to Login'}
              onPress={() => {
                if (isChangeMode) {
                  router.back();
                } else {
                  router.replace('/(auth)/login');
                }
              }}
              size="lg"
              style={{ marginTop: Spacing.xxl, width: '70%' }}
            />
          </Animated.View>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground variant="auth">
      <View style={styles.container}>
        {/* Back Button */}
        <AnimatedPressable
          style={styles.backButton}
          onPress={() => {
            if (step === 'otp' && !isChangeMode) {
              setStep('email');
              setOtpText('');
              setError('');
            } else if (step === 'password') {
              setStep('otp');
              setOtpText('');
              setError('');
            } else {
              router.back();
            }
          }}
        >
          <Feather name="arrow-left" size={22} color={Colors.text.primary} />
        </AnimatedPressable>

        {/* Title */}
        <Text style={styles.title}>
          {isChangeMode ? 'Change Password' : 'Reset Password'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'email'
            ? "Enter your email and we'll send you an 8-digit verification code."
            : step === 'otp'
            ? `Enter the 8-digit code sent to ${maskEmail(email)}`
            : 'Create a strong new password for your account.'}
        </Text>

        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i <= stepIndex && styles.stepDotActive,
                i === stepIndex && styles.stepDotCurrent,
              ]}
            />
          ))}
        </View>

        {/* Error Banner */}
        {error ? (
          <Animated.View style={shakeStyle}>
            <GlassCard intensity="subtle" padding="sm" style={styles.errorBanner}>
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Step Content */}
        <GlassCard intensity="medium" padding="lg">
          {/* Step 1: Email */}
          {step === 'email' && (
            <View>
              <Input
                label="Email"
                icon="mail"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                containerStyle={styles.inputSpacing}
              />
              <Button
                title="Send Verification Code"
                onPress={() => handleSendCode()}
                loading={loading}
                fullWidth
                size="lg"
              />
            </View>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <View>
              <Text style={styles.otpLabel}>Verification Code</Text>
              
              {/* Tap to focus wrapper */}
              <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpRow}>
                {Array.from({ length: 8 }).map((_, i) => {
                  const digit = otpText[i] || '';
                  const isFocused = i === otpText.length;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.otpBox,
                        digit ? styles.otpBoxFilled : undefined,
                        isFocused ? styles.otpBoxFocused : undefined,
                      ]}
                    >
                      <Text style={styles.otpBoxText}>{digit}</Text>
                    </View>
                  );
                })}
                
                {/* Hidden real input field */}
                <TextInput
                  ref={inputRef}
                  value={otpText}
                  onChangeText={(val) => {
                    const cleaned = val.replace(/\D/g, '').slice(0, 8);
                    setOtpText(cleaned);
                    if (cleaned.length === 8) {
                      Keyboard.dismiss();
                      handleVerifyOTP(cleaned);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={8}
                  style={styles.hiddenInput}
                  caretHidden
                  autoFocus
                />
              </Pressable>

              {/* Resend Timer */}
              <View style={styles.resendRow}>
                {resendTimer > 0 ? (
                  <Text style={styles.resendTimerText}>
                    Resend code in {resendTimer}s
                  </Text>
                ) : (
                  <Pressable onPress={() => handleSendCode(email.trim())}>
                    <Text style={styles.resendLink}>Resend Code</Text>
                  </Pressable>
                )}
              </View>

              <Button
                title="Verify Code"
                onPress={() => handleVerifyOTP()}
                loading={loading}
                fullWidth
                size="lg"
              />
            </View>
          )}

          {/* Step 3: New Password */}
          {step === 'password' && (
            <View>
              <View style={styles.passwordContainer}>
                <Input
                  label="New Password"
                  icon="lock"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  containerStyle={styles.inputSpacing}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color="rgba(255,255,255,0.3)"
                  />
                </Pressable>
              </View>

              {/* Password Strength */}
              {newPassword.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBarBg}>
                    <View
                      style={[
                        styles.strengthBarFill,
                        { width: strength.width as any, backgroundColor: strength.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>
                    {strength.label}
                  </Text>
                </View>
              )}

              <Input
                label="Confirm Password"
                icon="lock"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                containerStyle={styles.inputSpacing}
              />

              <Button
                title="Update Password"
                onPress={handleUpdatePassword}
                loading={loading}
                fullWidth
                size="lg"
              />
            </View>
          )}
        </GlassCard>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: 60,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },

  // Step Indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.xxl,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  stepDotActive: {
    backgroundColor: Colors.accent.primary,
  },
  stepDotCurrent: {
    width: 24,
    borderRadius: 4,
  },

  // Error
  errorBanner: {
    marginBottom: Spacing.lg,
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.error,
    marginLeft: Spacing.sm,
    flex: 1,
  },

  // Inputs
  inputSpacing: {
    marginBottom: Spacing.xxl,
  },
  passwordContainer: {
    position: 'relative',
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 38,
    padding: 8,
  },

  // OTP
  otpLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: 'rgba(255, 255, 255, 0.50)',
    marginBottom: Spacing.md,
    letterSpacing: 0.3,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.xl,
    position: 'relative',
  },
  otpBox: {
    width: 32,
    height: 48,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: Colors.accent.primary,
    backgroundColor: 'rgba(190, 255, 108, 0.06)',
  },
  otpBoxFocused: {
    borderColor: Colors.accent.primary,
    borderWidth: 1.5,
  },
  otpBoxText: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  resendTimerText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: 'rgba(255,255,255,0.35)',
  },
  resendLink: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
    color: Colors.accent.olive,
  },

  // Password Strength
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    marginTop: -Spacing.lg,
  },
  strengthBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
  },

  // Success
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  successIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(190, 255, 108, 0.1)',
    marginBottom: Spacing.xxl,
  },
  successTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  successText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 24,
  },
});
