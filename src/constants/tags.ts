/**
 * MoodMap - Quick Tags
 * Used during mood check-in for fast context tagging
 */

import { Feather } from '@expo/vector-icons';

export interface TagDefinition {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  category: 'activity' | 'social' | 'health' | 'environment';
}

export const TAGS: TagDefinition[] = [
  { key: 'study', label: 'Study', icon: 'book-open', category: 'activity' },
  { key: 'work', label: 'Work', icon: 'briefcase', category: 'activity' },
  { key: 'exam', label: 'Exam', icon: 'edit-3', category: 'activity' },
  { key: 'exercise', label: 'Exercise', icon: 'activity', category: 'activity' },
  { key: 'hobby', label: 'Hobby', icon: 'pen-tool', category: 'activity' },
  { key: 'travel', label: 'Travel', icon: 'navigation', category: 'activity' },

  { key: 'family', label: 'Family', icon: 'users', category: 'social' },
  { key: 'friends', label: 'Friends', icon: 'user-plus', category: 'social' },
  { key: 'alone', label: 'Alone', icon: 'user', category: 'social' },
  { key: 'social', label: 'Social', icon: 'message-circle', category: 'social' },
  { key: 'date', label: 'Date', icon: 'heart', category: 'social' },

  { key: 'sleep', label: 'Sleep', icon: 'moon', category: 'health' },
  { key: 'food', label: 'Food', icon: 'coffee', category: 'health' },
  { key: 'health', label: 'Health', icon: 'heart', category: 'health' },

  { key: 'weather', label: 'Weather', icon: 'cloud', category: 'environment' },
  { key: 'music', label: 'Music', icon: 'music', category: 'environment' },
  { key: 'nature', label: 'Nature', icon: 'wind', category: 'environment' },
];

export const TAG_MAP = Object.fromEntries(
  TAGS.map((t) => [t.key, t])
) as Record<string, TagDefinition>;
