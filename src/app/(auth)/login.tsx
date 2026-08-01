/**
 * MoodMap — Login Screen 
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { GradientBackground, Button, Input, GlassCard, GoogleLogo } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing } from '@/constants/layout';
import { signInWithEmail, signInWithGoogle } from '@/lib/auth';


export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);

    const result = await signInWithEmail(email.trim(), password);

    if (!result.success) {
      setError(result.error ?? 'Login failed. Please try again.');
      setLoading(false);
    } else {
      // Navigate to root — index.tsx will redirect to onboarding or home
      router.replace('/');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);

    const result = await signInWithGoogle();

    if (!result.success) {
      if (result.error !== 'Google sign-in was canceled') {
        setError(result.error ?? 'Google sign-in failed.');
      }
      setGoogleLoading(false);
    } else {
      router.replace('/');
    }
  };


  return (
    <GradientBackground variant="auth">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <View style={styles.header}>
            <View style={styles.logo}><Feather name="map" size={34} color={Colors.accent.olive} /></View>
            <Text style={styles.appName}>MoodMap</Text>
            <Text style={styles.subtitle}>
              Your personal mood companion
            </Text>
          </View>

          {/* Glass Login Card */}
          <GlassCard intensity="medium" padding="lg" style={styles.formCard}>
            <Text style={styles.formTitle}>Welcome back</Text>

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
              autoComplete="email"
              containerStyle={styles.inputSpacing}
            />

            <View style={styles.passwordContainer}>
              <Input
                label="Password"
                icon="lock"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
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

            <Pressable
              style={styles.forgotButton}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              size="lg"
            />
          </GlassCard>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          <Button
            title="Continue with Google"
            variant="secondary"
            onPress={handleGoogleLogin}
            loading={googleLoading}
            fullWidth
            size="lg"
            icon={<GoogleLogo size={20} />}
          />



          {/* Sign Up Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don&apos;t have an account?{' '}
            </Text>
            <Pressable onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: 90,
    paddingBottom: Spacing.section,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl + 8,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(190, 255, 108, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  appName: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.hero,
    color: Colors.accent.olive,
    marginBottom: Spacing.xs,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.3,
  },

  // Form Card
  formCard: {
    marginBottom: Spacing.xxl,
  },
  formTitle: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.xxl,
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

  // Input
  inputSpacing: {
    marginBottom: Spacing.lg,
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

  // Forgot
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.xxl,
    marginTop: -Spacing.sm,
  },
  forgotText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.bodySmall,
    color: Colors.accent.olive,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: 'rgba(255,255,255,0.25)',
    marginHorizontal: Spacing.lg,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xxxl,
  },
  footerText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    color: 'rgba(255,255,255,0.4)',
  },
  footerLink: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    color: Colors.accent.olive,
  },
});

