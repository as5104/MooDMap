/**
 * MoodMap — SQLite Database Schema
 * Using Drizzle ORM for type-safe queries
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

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
  sleepHours: real('sleep_hours'),
  sleepQuality: integer('sleep_quality'),
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
  isComfort: integer('is_comfort').notNull().default(0), // 0 = false, 1 = true
  lastShownAt: text('last_shown_at'), // ISO datetime when surfaced in Comfort Box
  subtype: text('subtype').notNull().default('journal'), // 'journal' | 'letter'
  recipient: text('recipient'), // 'future_self' | 'past_self' | 'someone'
  recipientName: text('recipient_name'), // optional recipient name
  revealAt: text('reveal_at'), // ISO datetime when future letter unlocks
  lockKeyword: text('lock_keyword'), // Secret keyword password for past_self / someone letters
  lockHint: text('lock_hint'), // Hint to remember secret keyword
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

// Mood-Music Tags (tracks what music is played during each mood)
export const moodMusicTags = sqliteTable('mood_music_tags', {
  id: text('id').primaryKey(),
  moodEntryId: text('mood_entry_id'),
  moodType: text('mood_type').notNull(),
  trackId: text('track_id').notNull(),
  trackName: text('track_name').notNull(),
  artistName: text('artist_name').notNull(),
  trackSource: text('track_source').notNull(),
  albumArt: text('album_art'),
  playCount: integer('play_count').notNull().default(1),
  lastPlayedAt: text('last_played_at').notNull(),
  userId: text('user_id'),
});

// Music Preferences (VIP users' taste profile from survey)
export const musicPreferences = sqliteTable('music_preferences', {
  userId: text('user_id').primaryKey(),
  preferences: text('preferences').notNull(), // JSON blob
  updatedAt: text('updated_at').notNull(),
});

// Recommendation Signals (skip/complete tracking for learning)
export const recommendationSignals = sqliteTable('recommendation_signals', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  trackId: text('track_id').notNull(),
  moodType: text('mood_type').notNull(),
  signalType: text('signal_type').notNull(), // 'skip' | 'complete'
  createdAt: text('created_at').notNull(),
});

// Spotify User Data Cache (daily snapshot of user's listening data)
export const spotifyUserDataCache = sqliteTable('spotify_user_data_cache', {
  userId: text('user_id').primaryKey(),
  data: text('data').notNull(), // JSON blob of SpotifyUserDataSnapshot
  fetchedAt: text('fetched_at').notNull(), // ISO timestamp
});

export const dailyRecommendedTracks = sqliteTable('daily_recommended_tracks', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  trackId: text('track_id').notNull(),
  trackTitle: text('track_title').notNull(),
  artistName: text('artist_name').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  createdAt: text('created_at').notNull(),
});

// Comfort Tracks
export const comfortTracks = sqliteTable('comfort_tracks', {
  id: text('id').primaryKey(), // trackId
  trackName: text('track_name').notNull(),
  artistName: text('artist_name').notNull(),
  trackSource: text('track_source').notNull(),
  albumArt: text('album_art'),
  audioUrl: text('audio_url'),
  duration: text('duration'),
  isComfort: integer('is_comfort').notNull().default(1),
  lastShownAt: text('last_shown_at'),
  createdAt: text('created_at').notNull(),
  userId: text('user_id'),
});
