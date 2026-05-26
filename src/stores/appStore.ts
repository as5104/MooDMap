/**
 * MoodMap — Zustand App Store
 * Global state management for auth, mood, and app state
 */

import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { MoodType } from '@/constants/moods';

interface TodayMood {
  id: string;
  moodType: MoodType;
  moodScore: number;
  energyLevel?: number;
  stressLevel?: number;
  tags?: string[];
  note?: string;
  date: string;
}

interface AppState {
  // ─── Auth ───
  session: Session | null;
  user: User | null;
  isAuthLoading: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;

  // ─── Onboarding ───
  hasCompletedOnboarding: boolean;
  setOnboardingComplete: (complete: boolean) => void;

  // ─── Today's Mood ───
  todayMood: TodayMood | null;
  setTodayMood: (mood: TodayMood | null) => void;

  // ─── Streaks ───
  moodStreak: number;
  journalStreak: number;
  setMoodStreak: (streak: number) => void;
  setJournalStreak: (streak: number) => void;

  // ─── XP & Level ───
  totalXP: number;
  addXP: (amount: number) => void;

  // ─── App State ───
  isAppReady: boolean;
  setAppReady: (ready: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  session: null,
  user: null,
  isAuthLoading: true,
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setAuthLoading: (isAuthLoading) => set({ isAuthLoading }),

  // Onboarding
  hasCompletedOnboarding: false,
  setOnboardingComplete: (hasCompletedOnboarding) => set({ hasCompletedOnboarding }),

  // Today's Mood
  todayMood: null,
  setTodayMood: (todayMood) => set({ todayMood }),

  // Streaks
  moodStreak: 0,
  journalStreak: 0,
  setMoodStreak: (moodStreak) => set({ moodStreak }),
  setJournalStreak: (journalStreak) => set({ journalStreak }),

  // XP
  totalXP: 0,
  addXP: (amount) => set((state) => ({ totalXP: state.totalXP + amount })),

  // App State
  isAppReady: false,
  setAppReady: (isAppReady) => set({ isAppReady }),
}));
