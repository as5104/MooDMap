/**
 * MoodMap - Journal Prompts
 * Writing prompts to help users who do not know what to journal about
 */

export interface JournalPrompt {
  id: string;
  text: string;
  shortLabel: string;
  category: 'gratitude' | 'reflection' | 'growth' | 'emotion' | 'mindfulness';
  icon: string;
}

export const JOURNAL_PROMPTS: JournalPrompt[] = [
  { id: 'g1', text: 'What made today feel good?', shortLabel: 'Feel Good', category: 'gratitude', icon: 'star' },
  { id: 'g2', text: 'What are you grateful for today?', shortLabel: 'Grateful', category: 'gratitude', icon: 'heart' },
  { id: 'g3', text: 'Who made a positive impact on your day?', shortLabel: 'People', category: 'gratitude', icon: 'users' },
  { id: 'g4', text: 'What small joy did you experience today?', shortLabel: 'Small Joy', category: 'gratitude', icon: 'sun' },

  { id: 'r1', text: 'What was the hardest part of today?', shortLabel: 'Hardest', category: 'reflection', icon: 'help-circle' },
  { id: 'r2', text: 'What is one thing you can let go of?', shortLabel: 'Let Go', category: 'reflection', icon: 'wind' },
  { id: 'r3', text: 'What did you learn about yourself today?', shortLabel: 'Self', category: 'reflection', icon: 'search' },
  { id: 'r4', text: 'If today had a theme, what would it be?', shortLabel: 'Theme', category: 'reflection', icon: 'aperture' },

  { id: 'w1', text: 'What is one thing you want to improve tomorrow?', shortLabel: 'Improve', category: 'growth', icon: 'trending-up' },
  { id: 'w2', text: 'What challenge are you proud of facing today?', shortLabel: 'Proud', category: 'growth', icon: 'award' },
  { id: 'w3', text: 'What would you tell your past self about today?', shortLabel: 'Past Self', category: 'growth', icon: 'message-circle' },
  { id: 'w4', text: 'What goal are you working toward right now?', shortLabel: 'Goals', category: 'growth', icon: 'target' },

  { id: 'e1', text: 'How are you really feeling right now?', shortLabel: 'Feelings', category: 'emotion', icon: 'message-square' },
  { id: 'e2', text: 'What emotion surprised you today?', shortLabel: 'Surprise', category: 'emotion', icon: 'eye' },
  { id: 'e3', text: 'What made you smile today, even briefly?', shortLabel: 'Smile', category: 'emotion', icon: 'smile' },
  { id: 'e4', text: 'What is weighing on your mind?', shortLabel: 'On Mind', category: 'emotion', icon: 'cloud-rain' },

  { id: 'm1', text: 'Describe this moment using your five senses.', shortLabel: 'Senses', category: 'mindfulness', icon: 'activity' },
  { id: 'm2', text: 'What sound brings you peace right now?', shortLabel: 'Peace', category: 'mindfulness', icon: 'bell' },
  { id: 'm3', text: 'Take three deep breaths. How do you feel now?', shortLabel: 'Breathe', category: 'mindfulness', icon: 'wind' },
  { id: 'm4', text: 'What does your ideal calm evening look like?', shortLabel: 'Evening', category: 'mindfulness', icon: 'moon' },
];

export const getRandomPrompt = (category?: JournalPrompt['category']): JournalPrompt => {
  const filtered = category
    ? JOURNAL_PROMPTS.filter((p) => p.category === category)
    : JOURNAL_PROMPTS;
  return filtered[Math.floor(Math.random() * filtered.length)];
};

/**
 * Mood-to-prompt category mapping.
 */
import type { MoodType } from './moods';

const MOOD_PROMPT_MAP: Record<MoodType, JournalPrompt['category'][]> = {
  happy:     ['gratitude', 'gratitude', 'emotion'],
  calm:      ['reflection', 'mindfulness', 'gratitude'],
  focused:   ['growth', 'growth', 'reflection'],
  peaceful:  ['mindfulness', 'mindfulness', 'gratitude'],
  motivated: ['growth', 'growth', 'gratitude'],
  sad:       ['emotion', 'emotion', 'reflection'],
  tired:     ['mindfulness', 'reflection', 'emotion'],
  anxious:   ['mindfulness', 'emotion', 'reflection'],
  angry:     ['reflection', 'emotion', 'mindfulness'],
  stressed:  ['mindfulness', 'mindfulness', 'emotion'],
};

/**
 * Get prompts tailored to today's mood.
 * Returns `count` prompts from categories relevant to the mood, with no duplicates.
 * Falls back to random if no mood is provided.
 */
export const getPromptsForMood = (moodType?: MoodType | null, count: number = 4): JournalPrompt[] => {
  if (!moodType) {
    // No mood recorded — return random mix
    const shuffled = [...JOURNAL_PROMPTS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  const categories = MOOD_PROMPT_MAP[moodType];
  const result: JournalPrompt[] = [];
  const usedIds = new Set<string>();

  // Pick one prompt per mapped category slot
  for (const cat of categories) {
    const candidates = JOURNAL_PROMPTS.filter(
      (p) => p.category === cat && !usedIds.has(p.id)
    );
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      result.push(pick);
      usedIds.add(pick.id);
    }
    if (result.length >= count) break;
  }

  // Fill remaining slots from any unused prompts
  if (result.length < count) {
    const remaining = JOURNAL_PROMPTS.filter((p) => !usedIds.has(p.id));
    const shuffled = remaining.sort(() => Math.random() - 0.5);
    for (const p of shuffled) {
      result.push(p);
      if (result.length >= count) break;
    }
  }

  return result;
};
