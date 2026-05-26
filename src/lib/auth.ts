/**
 * MoodMap — Auth Helpers
 * Wraps Supabase Auth methods for login, signup, Google OAuth, and session management
 */

import { supabase } from './supabase';

export interface AuthResult {
  success: boolean;
  error?: string;
  /** true if user must confirm email before they can sign in */
  needsConfirmation?: boolean;
}

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

/** Send password reset email */
export const resetPassword = async (email: string): Promise<AuthResult> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
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
