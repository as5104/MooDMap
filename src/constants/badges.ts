/**
 * MoodMap — Badge / Achievement Definitions
 * Gamification system with progress tracking
 */

export interface BadgeDefinition {
  key: string;
  title: string;
  description: string;
  target: number;
  icon: string;
  category: 'mood' | 'journal' | 'activity' | 'exploration';
  xpReward: number;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ─── Mood Tracking ───
  { key: 'first_step',    title: 'First Step',     description: 'Log your first mood',             target: 1,   icon: '👣', category: 'mood', xpReward: 10 },
  { key: 'consistency_7', title: 'Consistency',     description: 'Log mood for 7 days straight',    target: 7,   icon: '🔥', category: 'mood', xpReward: 50 },
  { key: 'habit_builder', title: 'Habit Builder',   description: '14-day mood streak',              target: 14,  icon: '🏗️', category: 'mood', xpReward: 100 },
  { key: 'mood_master',   title: 'Mood Master',     description: '30-day mood streak',              target: 30,  icon: '🏆', category: 'mood', xpReward: 200 },
  { key: 'centurion',     title: 'Centurion',       description: '100 mood entries total',          target: 100, icon: '💯', category: 'mood', xpReward: 500 },

  // ─── Journaling ───
  { key: 'first_words',     title: 'First Words',     description: 'Write your first journal entry', target: 1,   icon: '✍️', category: 'journal', xpReward: 10 },
  { key: 'deep_reflector',  title: 'Deep Reflector',  description: '30 journal entries',             target: 30,  icon: '📖', category: 'journal', xpReward: 200 },
  { key: 'storyteller',     title: 'Storyteller',     description: '100 journal entries',            target: 100, icon: '📚', category: 'journal', xpReward: 500 },
  { key: 'journal_streak_7', title: 'Journal Habit',  description: '7-day journaling streak',        target: 7,   icon: '📝', category: 'journal', xpReward: 50 },

  // ─── Activities ───
  { key: 'calm_seeker',     title: 'Calm Seeker',     description: 'Complete 10 breathing exercises',  target: 10, icon: '🧘', category: 'activity', xpReward: 75 },
  { key: 'gratitude_guru',  title: 'Gratitude Guru',  description: 'Log gratitude 20 times',          target: 20, icon: '🙏', category: 'activity', xpReward: 100 },
  { key: 'sound_explorer',  title: 'Sound Explorer',  description: 'Listen to 5 ambient sessions',    target: 5,  icon: '🎵', category: 'activity', xpReward: 30 },

  // ─── Exploration ───
  { key: 'all_moods',       title: 'Full Spectrum',   description: 'Log every mood type at least once',   target: 10, icon: '🌈', category: 'exploration', xpReward: 75 },
  { key: 'night_owl',       title: 'Night Owl',       description: 'Log mood after midnight 5 times',     target: 5,  icon: '🦉', category: 'exploration', xpReward: 30 },
  { key: 'early_bird',      title: 'Early Bird',      description: 'Log mood before 7 AM 5 times',       target: 5,  icon: '🐦', category: 'exploration', xpReward: 30 },
  { key: 'weekend_warrior', title: 'Weekend Warrior', description: 'Log mood every weekend for a month',  target: 8,  icon: '🎯', category: 'exploration', xpReward: 50 },
];

export const BADGE_MAP = Object.fromEntries(
  BADGE_DEFINITIONS.map((b) => [b.key, b])
) as Record<string, BadgeDefinition>;

/**
 * Level system — XP thresholds
 */
export const LEVELS = [
  { level: 1,  title: 'Seedling',     xpRequired: 0 },
  { level: 2,  title: 'Sprout',       xpRequired: 50 },
  { level: 3,  title: 'Sapling',      xpRequired: 150 },
  { level: 4,  title: 'Growing',      xpRequired: 300 },
  { level: 5,  title: 'Blooming',     xpRequired: 500 },
  { level: 6,  title: 'Flourishing',  xpRequired: 800 },
  { level: 7,  title: 'Thriving',     xpRequired: 1200 },
  { level: 8,  title: 'Radiant',      xpRequired: 1800 },
  { level: 9,  title: 'Luminous',     xpRequired: 2500 },
  { level: 10, title: 'Enlightened',  xpRequired: 3500 },
];

export const getLevelForXP = (xp: number) => {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpRequired) return LEVELS[i];
  }
  return LEVELS[0];
};

export const getNextLevel = (currentLevel: number) => {
  return LEVELS.find((l) => l.level === currentLevel + 1) ?? null;
};
