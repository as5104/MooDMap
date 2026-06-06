/**
 * MoodMap — Zustand App Store
 * Global state: auth, mood data, streaks, XP
 */

import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { MoodType } from '@/constants/moods';
import type { DayMoodData, MoodEntryRow } from '@/services/moodService';
import type { JournalEntryRow } from '@/services/journalService';

export type JournalViewMode = 'list' | 'grid';

interface TodayMood {
  id: string;
  moodType: MoodType;
  moodScore: number;
  energyLevel?: number;
  stressLevel?: number;
  sleepHours?: number;
  sleepQuality?: number;
  tags?: string[];
  note?: string;
  date: string;
}

interface AppState {
  // Auth
  session: Session | null;
  user: User | null;
  isAuthLoading: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;

  // Onboarding
  hasCompletedOnboarding: boolean;
  setOnboardingComplete: (complete: boolean) => void;

  // Today's Mood
  todayMood: TodayMood | null;
  setTodayMood: (mood: TodayMood | null) => void;

  // Weekly Moods (cached)
  weeklyMoods: DayMoodData[];
  setWeeklyMoods: (moods: DayMoodData[]) => void;

  // Mood Score (cached)
  moodScore: number;
  setMoodScore: (score: number) => void;

  // Streaks
  moodStreak: number;
  journalStreak: number;
  setMoodStreak: (streak: number) => void;
  setJournalStreak: (streak: number) => void;

  // Journal Cache
  journalCount: number;
  setJournalCount: (count: number) => void;
  latestJournal: { title: string | null; content: string; date: string } | null;
  setLatestJournal: (journal: { title: string | null; content: string; date: string } | null) => void;
  journalViewMode: JournalViewMode;
  setJournalViewMode: (mode: JournalViewMode) => void;

  // XP & Level
  totalXP: number;
  addXP: (amount: number) => void;
  setTotalXP: (xp: number) => void;

  // App State
  isAppReady: boolean;
  setAppReady: (ready: boolean) => void;

  // Data Refresh Flag
  dataVersion: number;
  refreshData: () => void;

  // Sign-Out Reset
  resetForSignOut: () => void;
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

  // Weekly Moods
  weeklyMoods: [],
  setWeeklyMoods: (weeklyMoods) => set({ weeklyMoods }),

  // Mood Score
  moodScore: 0,
  setMoodScore: (moodScore) => set({ moodScore }),

  // Streaks
  moodStreak: 0,
  journalStreak: 0,
  setMoodStreak: (moodStreak) => set({ moodStreak }),
  setJournalStreak: (journalStreak) => set({ journalStreak }),

  // Journal Cache
  journalCount: 0,
  setJournalCount: (journalCount) => set({ journalCount }),
  latestJournal: null,
  setLatestJournal: (latestJournal) => set({ latestJournal }),
  journalViewMode: 'list',
  setJournalViewMode: (journalViewMode) => {
    set({ journalViewMode });
    try {
      const { saveSetting } = require('@/services/settingsService');
      saveSetting('journal_view_mode', journalViewMode);
    } catch (e) {
      console.error('[Store] Failed to save view mode setting:', e);
    }
  },

  // XP
  totalXP: 0,
  addXP: (amount) => set((state) => ({ totalXP: state.totalXP + amount })),
  setTotalXP: (totalXP) => set({ totalXP }),

  // App State
  isAppReady: false,
  setAppReady: (isAppReady) => set({ isAppReady }),

  // Data refresh — increment to trigger re-fetches
  dataVersion: 0,
  refreshData: () => set((state) => ({ dataVersion: state.dataVersion + 1 })),

  // Reset all user-specific state on sign-out
  resetForSignOut: () =>
    set({
      session: null,
      user: null,
      todayMood: null,
      weeklyMoods: [],
      moodScore: 0,
      moodStreak: 0,
      journalStreak: 0,
      journalCount: 0,
      latestJournal: null,
      totalXP: 0,
      hasCompletedOnboarding: false,
      dataVersion: 0,
    }),
}));
