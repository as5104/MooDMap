/**
 * MoodMap — SQLite Database Schema
 * Using Drizzle ORM for type-safe queries
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Mood Entries
export const moodEntries = sqliteTable('mood_entries', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  moodType: text('mood_type').notNull(),
  moodScore: integer('mood_score').notNull(), // 1-10
  energyLevel: integer('energy_level'), // 1-5
  stressLevel: integer('stress_level'), // 1-5
  tags: text('tags'), // JSON array
  note: text('note'),
  timeOfDay: text('time_of_day'), // morning, afternoon, evening, night
  userId: text('user_id'), // Supabase user ID
});

// Journal Entries
export const journalEntries = sqliteTable('journal_entries', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  date: text('date').notNull(),
  title: text('title'),
  content: text('content').notNull(),
  moodEntryId: text('mood_entry_id'),
  promptUsed: text('prompt_used'),
  images: text('images'), // JSON array of Supabase Storage URLs
  userId: text('user_id'),
});

// User Streaks
export const streaks = sqliteTable('streaks', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'mood' | 'journal'
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastActiveDate: text('last_active_date'),
  totalEntries: integer('total_entries').notNull().default(0),
  userId: text('user_id'),
});

// Badges
export const badges = sqliteTable('badges', {
  id: text('id').primaryKey(),
  badgeKey: text('badge_key').notNull(),
  unlockedAt: text('unlocked_at'), // null = locked
  progress: integer('progress').notNull().default(0),
  target: integer('target').notNull(),
  userId: text('user_id'),
});

// User Settings
export const userSettings = sqliteTable('user_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
