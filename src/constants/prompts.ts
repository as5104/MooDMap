/**
 * MoodMap — Journal Prompts
 * Writing prompts to help users who don't know what to journal about
 */

export interface JournalPrompt {
  id: string;
  text: string;
  category: 'gratitude' | 'reflection' | 'growth' | 'emotion' | 'mindfulness';
  emoji: string;
}

export const JOURNAL_PROMPTS: JournalPrompt[] = [
  // Gratitude
  { id: 'g1', text: 'What made today feel good?', category: 'gratitude', emoji: '✨' },
  { id: 'g2', text: 'What are you grateful for today?', category: 'gratitude', emoji: '🙏' },
  { id: 'g3', text: 'Who made a positive impact on your day?', category: 'gratitude', emoji: '💛' },
  { id: 'g4', text: 'What small joy did you experience today?', category: 'gratitude', emoji: '🌸' },

  // Reflection
  { id: 'r1', text: 'What was the hardest part of today?', category: 'reflection', emoji: '🤔' },
  { id: 'r2', text: 'What is one thing you can let go of?', category: 'reflection', emoji: '🍃' },
  { id: 'r3', text: 'What did you learn about yourself today?', category: 'reflection', emoji: '🔍' },
  { id: 'r4', text: 'If today had a theme, what would it be?', category: 'reflection', emoji: '🎭' },

  // Growth
  { id: 'w1', text: 'What is one thing you want to improve tomorrow?', category: 'growth', emoji: '🌱' },
  { id: 'w2', text: 'What challenge are you proud of facing today?', category: 'growth', emoji: '💪' },
  { id: 'w3', text: 'What would you tell your past self about today?', category: 'growth', emoji: '💬' },
  { id: 'w4', text: 'What goal are you working toward right now?', category: 'growth', emoji: '🎯' },

  // Emotion
  { id: 'e1', text: 'How are you really feeling right now?', category: 'emotion', emoji: '💭' },
  { id: 'e2', text: 'What emotion surprised you today?', category: 'emotion', emoji: '😮' },
  { id: 'e3', text: 'What made you smile today, even briefly?', category: 'emotion', emoji: '😊' },
  { id: 'e4', text: 'What is weighing on your mind?', category: 'emotion', emoji: '🌊' },

  // Mindfulness
  { id: 'm1', text: 'Describe this moment using your five senses.', category: 'mindfulness', emoji: '🧘' },
  { id: 'm2', text: 'What sound brings you peace right now?', category: 'mindfulness', emoji: '🔔' },
  { id: 'm3', text: 'Take three deep breaths. How do you feel now?', category: 'mindfulness', emoji: '🌬️' },
  { id: 'm4', text: 'What does your ideal calm evening look like?', category: 'mindfulness', emoji: '🌙' },
];

/** Get a random prompt, optionally filtered by category */
export const getRandomPrompt = (category?: JournalPrompt['category']): JournalPrompt => {
  const filtered = category
    ? JOURNAL_PROMPTS.filter((p) => p.category === category)
    : JOURNAL_PROMPTS;
  return filtered[Math.floor(Math.random() * filtered.length)];
};
