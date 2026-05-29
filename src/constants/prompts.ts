/**
 * MoodMap - Journal Prompts
 * Writing prompts to help users who do not know what to journal about
 */

export interface JournalPrompt {
  id: string;
  text: string;
  category: 'gratitude' | 'reflection' | 'growth' | 'emotion' | 'mindfulness';
  icon: string;
}

export const JOURNAL_PROMPTS: JournalPrompt[] = [
  { id: 'g1', text: 'What made today feel good?', category: 'gratitude', icon: 'star' },
  { id: 'g2', text: 'What are you grateful for today?', category: 'gratitude', icon: 'heart' },
  { id: 'g3', text: 'Who made a positive impact on your day?', category: 'gratitude', icon: 'users' },
  { id: 'g4', text: 'What small joy did you experience today?', category: 'gratitude', icon: 'sun' },

  { id: 'r1', text: 'What was the hardest part of today?', category: 'reflection', icon: 'help-circle' },
  { id: 'r2', text: 'What is one thing you can let go of?', category: 'reflection', icon: 'wind' },
  { id: 'r3', text: 'What did you learn about yourself today?', category: 'reflection', icon: 'search' },
  { id: 'r4', text: 'If today had a theme, what would it be?', category: 'reflection', icon: 'aperture' },

  { id: 'w1', text: 'What is one thing you want to improve tomorrow?', category: 'growth', icon: 'trending-up' },
  { id: 'w2', text: 'What challenge are you proud of facing today?', category: 'growth', icon: 'award' },
  { id: 'w3', text: 'What would you tell your past self about today?', category: 'growth', icon: 'message-circle' },
  { id: 'w4', text: 'What goal are you working toward right now?', category: 'growth', icon: 'target' },

  { id: 'e1', text: 'How are you really feeling right now?', category: 'emotion', icon: 'message-square' },
  { id: 'e2', text: 'What emotion surprised you today?', category: 'emotion', icon: 'eye' },
  { id: 'e3', text: 'What made you smile today, even briefly?', category: 'emotion', icon: 'smile' },
  { id: 'e4', text: 'What is weighing on your mind?', category: 'emotion', icon: 'cloud-rain' },

  { id: 'm1', text: 'Describe this moment using your five senses.', category: 'mindfulness', icon: 'activity' },
  { id: 'm2', text: 'What sound brings you peace right now?', category: 'mindfulness', icon: 'bell' },
  { id: 'm3', text: 'Take three deep breaths. How do you feel now?', category: 'mindfulness', icon: 'wind' },
  { id: 'm4', text: 'What does your ideal calm evening look like?', category: 'mindfulness', icon: 'moon' },
];

export const getRandomPrompt = (category?: JournalPrompt['category']): JournalPrompt => {
  const filtered = category
    ? JOURNAL_PROMPTS.filter((p) => p.category === category)
    : JOURNAL_PROMPTS;
  return filtered[Math.floor(Math.random() * filtered.length)];
};
