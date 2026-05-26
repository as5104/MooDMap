/**
 * MoodMap — Forgot Password Screen (Freud-Inspired)
 * Warm earthy password reset
 */

import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, Button, Input, GlassCard, AnimatedPressable } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing } from '@/constants/layout';
import { resetPassword } from '@/lib/auth';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    setError('');
    setLoading(true);

    const result = await resetPassword(email.trim());
    if (!result.success) {
      setError(result.error ?? 'Failed to send reset email');
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <GradientBackground variant="glow">
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>📧</Text>
          <Text style={styles.successTitle}>Email Sent</Text>
          <Text style={styles.successText}>
            Check your inbox for a password reset link.
          </Text>
          <Button
            title="Back to Login"
            onPress={() => router.replace('/(auth)/login')}
            size="lg"
            style={{ marginTop: Spacing.xxl }}
          />
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground variant="auth">
      <View style={styles.container}>
        <AnimatedPressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.text.primary} />
        </AnimatedPressable>

        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send you a link to reset your password.
        </Text>

        <GlassCard intensity="medium" padding="lg">
          {error ? (
            <GlassCard intensity="subtle" padding="sm" style={styles.errorBanner}>
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </GlassCard>
          ) : null}

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
            title="Send Reset Link"
            onPress={handleReset}
            loading={loading}
            fullWidth
            size="lg"
          />
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
    backgroundColor: 'rgba(240,235,227,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxxl,
    borderWidth: 1,
    borderColor: 'rgba(240,235,227,0.08)',
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
    color: 'rgba(240,235,227,0.45)',
    marginBottom: Spacing.xxxl,
    lineHeight: 24,
  },
  errorBanner: {
    marginBottom: Spacing.lg,
    borderColor: 'rgba(196, 92, 74, 0.2)',
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
  inputSpacing: {
    marginBottom: Spacing.xxl,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  successEmoji: { fontSize: 64, marginBottom: Spacing.xxl },
  successTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  successText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: 'rgba(240,235,227,0.5)',
    textAlign: 'center',
  },
});
