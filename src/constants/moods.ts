/**
 * MoodMap — Mood Definitions
 * Each mood has a type, emoji, label, color, gradient, and default suggestion
 */

export type MoodType =
  | 'happy' | 'calm' | 'focused' | 'peaceful'
  | 'sad' | 'tired' | 'anxious' | 'angry'
  | 'stressed' | 'motivated';

export type SuggestionType =
  | 'breathing' | 'calming_music' | 'reflection'
  | 'gratitude' | 'grounding' | 'pause_timer'
  | 'rest' | 'productivity' | 'meditation'
  | 'share_win';

export interface MoodDefinition {
  type: MoodType;
  emoji: string;
  label: string;
  color: string;
  gradient: [string, string];
  suggestion: SuggestionType;
  score: number; // default mood positivity score 1-10
}

export const MOODS: MoodDefinition[] = [
  {
    type: 'happy',
    emoji: '😊',
    label: 'Happy',
    color: '#FFD60A',
    gradient: ['#FFD60A', '#F4C542'],
    suggestion: 'gratitude',
    score: 9,
  },
  {
    type: 'calm',
    emoji: '😌',
    label: 'Calm',
    color: '#19C7B8',
    gradient: ['#19C7B8', '#0FA89D'],
    suggestion: 'reflection',
    score: 8,
  },
  {
    type: 'focused',
    emoji: '🎯',
    label: 'Focused',
    color: '#0B4D8A',
    gradient: ['#0B4D8A', '#083D6E'],
    suggestion: 'productivity',
    score: 7,
  },
  {
    type: 'peaceful',
    emoji: '🧘',
    label: 'Peaceful',
    color: '#6EE7A8',
    gradient: ['#6EE7A8', '#4CD490'],
    suggestion: 'meditation',
    score: 8,
  },
  {
    type: 'motivated',
    emoji: '🔥',
    label: 'Motivated',
    color: '#00D9FF',
    gradient: ['#00D9FF', '#00B8D9'],
    suggestion: 'productivity',
    score: 8,
  },
  {
    type: 'sad',
    emoji: '😢',
    label: 'Sad',
    color: '#6C7A89',
    gradient: ['#6C7A89', '#4A5568'],
    suggestion: 'calming_music',
    score: 3,
  },
  {
    type: 'tired',
    emoji: '😴',
    label: 'Tired',
    color: '#4A5568',
    gradient: ['#4A5568', '#2D3748'],
    suggestion: 'rest',
    score: 4,
  },
  {
    type: 'anxious',
    emoji: '😰',
    label: 'Anxious',
    color: '#7C5CFC',
    gradient: ['#7C5CFC', '#6244E0'],
    suggestion: 'grounding',
    score: 3,
  },
  {
    type: 'angry',
    emoji: '😤',
    label: 'Angry',
    color: '#FF6B6B',
    gradient: ['#FF6B6B', '#E05050'],
    suggestion: 'pause_timer',
    score: 2,
  },
  {
    type: 'stressed',
    emoji: '😣',
    label: 'Stressed',
    color: '#E85D75',
    gradient: ['#E85D75', '#CC4060'],
    suggestion: 'breathing',
    score: 3,
  },
];

export const MOOD_MAP = Object.fromEntries(
  MOODS.map((m) => [m.type, m])
) as Record<MoodType, MoodDefinition>;

export const getMoodByType = (type: MoodType): MoodDefinition => MOOD_MAP[type];
