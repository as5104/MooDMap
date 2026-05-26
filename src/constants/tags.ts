/**
 * MoodMap — Quick Tags
 * Used during mood check-in for fast context tagging
 */

export interface TagDefinition {
  key: string;
  label: string;
  emoji: string;
  category: 'activity' | 'social' | 'health' | 'environment';
}

export const TAGS: TagDefinition[] = [
  // Activities
  { key: 'study',    label: 'Study',    emoji: '📚', category: 'activity' },
  { key: 'work',     label: 'Work',     emoji: '💼', category: 'activity' },
  { key: 'exam',     label: 'Exam',     emoji: '📝', category: 'activity' },
  { key: 'exercise', label: 'Exercise', emoji: '🏃', category: 'activity' },
  { key: 'hobby',    label: 'Hobby',    emoji: '🎨', category: 'activity' },
  { key: 'travel',   label: 'Travel',   emoji: '✈️', category: 'activity' },

  // Social
  { key: 'family',   label: 'Family',   emoji: '👨‍👩‍👧', category: 'social' },
  { key: 'friends',  label: 'Friends',  emoji: '👫', category: 'social' },
  { key: 'alone',    label: 'Alone',    emoji: '🧘', category: 'social' },
  { key: 'social',   label: 'Social',   emoji: '🎉', category: 'social' },
  { key: 'date',     label: 'Date',     emoji: '❤️', category: 'social' },

  // Health
  { key: 'sleep',    label: 'Sleep',    emoji: '😴', category: 'health' },
  { key: 'food',     label: 'Food',     emoji: '🍽️', category: 'health' },
  { key: 'health',   label: 'Health',   emoji: '🏥', category: 'health' },

  // Environment
  { key: 'weather',  label: 'Weather',  emoji: '🌤️', category: 'environment' },
  { key: 'music',    label: 'Music',    emoji: '🎵', category: 'environment' },
  { key: 'nature',   label: 'Nature',   emoji: '🌿', category: 'environment' },
];

export const TAG_MAP = Object.fromEntries(
  TAGS.map((t) => [t.key, t])
) as Record<string, TagDefinition>;
