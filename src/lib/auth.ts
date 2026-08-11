/**
 * MoodMap — Auth Helpers
 * Wraps Supabase Auth methods for login, signup, Google OAuth, and session management
 */

import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export interface AuthResult {
  success: boolean;
  error?: string;
  /** true if user must confirm email before they can sign in */
  needsConfirmation?: boolean;
}

/** Sign in with Google using Supabase OAuth & WebBrowser */
export const signInWithGoogle = async (): Promise<AuthResult> => {
  try {
    const redirectTo = makeRedirectUri({
      scheme: 'moodmap',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) return { success: false, error: error.message };
    if (!data?.url) return { success: false, error: 'Failed to generate Google OAuth URL' };

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (res.type === 'success' && res.url) {
      const url = res.url;

      // Check for error in callback URL
      if (url.includes('error=')) {
        const cleanUrl = url.replace('#', '?');
        const searchParams = new URLSearchParams(cleanUrl.substring(cleanUrl.indexOf('?')));
        const errDesc = searchParams.get('error_description') ?? 'Google sign-in was denied';
        return { success: false, error: errDesc };
      }

      // Check hash params (#access_token=...&refresh_token=...)
      if (url.includes('access_token=') && url.includes('refresh_token=')) {
        const hashStr = url.substring(url.indexOf('#') + 1);
        const params = new URLSearchParams(hashStr);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) return { success: false, error: setSessionError.message };
          return { success: true };
        }
      }

      // Check query params (?code=...)
      if (url.includes('code=')) {
        const cleanUrl = url.replace('#', '?');
        const searchParams = new URLSearchParams(cleanUrl.substring(cleanUrl.indexOf('?')));
        const code = searchParams.get('code');

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) return { success: false, error: exchangeError.message };
          return { success: true };
        }
      }

      // Fallback check session
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) return { success: true };
    }

    if (res.type === 'cancel' || res.type === 'dismiss') {
      return { success: false, error: 'Google sign-in was canceled' };
    }

    return { success: false, error: 'Google sign-in could not be completed' };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'An error occurred during Google sign-in' };
  }
};


/** Sign up with email and password */
export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName?: string
): Promise<AuthResult> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName ?? email.split('@')[0],
      },
    },
  });

  if (error) return { success: false, error: error.message };

  // If session exists, user is logged in (email confirmation is off)
  // If no session, user needs to confirm email
  const needsConfirmation = !data.session;
  return { success: true, needsConfirmation };
};

/** Sign in with email and password */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
};

/** Send password reset email (Supabase sends OTP code via configured SMTP) */
export const resetPassword = async (email: string): Promise<AuthResult> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return { success: false, error: error.message };
  return { success: true };
};

/** Verify the 8-digit OTP code from the password reset email */
export const verifyPasswordResetOTP = async (
  email: string,
  token: string
): Promise<AuthResult> => {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'recovery',
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

/** Update the current user's profile metadata (display name, etc.) */
export const updateUserProfile = async (
  data: { display_name?: string }
): Promise<AuthResult> => {
  const { error } = await supabase.auth.updateUser({
    data,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

/** Update the current user's password */
export const updatePassword = async (
  newPassword: string
): Promise<AuthResult> => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

/** Sign out the current user */
export const signOut = async (): Promise<AuthResult> => {
  const { error } = await supabase.auth.signOut();
  if (error) return { success: false, error: error.message };
  return { success: true };
};

/** Get the current session */
export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
};

/** Get the current user */
export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
};

/** Listen to auth state changes */
export const onAuthStateChange = (
  callback: (event: string, session: unknown) => void
) => {
  return supabase.auth.onAuthStateChange(callback);
};
