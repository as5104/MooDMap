/**
 * MoodMap — Mood Definitions (Premium Palette)
 * Each mood has a type, emoji, label, color, bgColor, faceColor, gradient, and suggestion
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
  bgColor: string;       // full-screen background
  faceColor: string;     // lighter face circle
  gradient: [string, string];
  suggestion: SuggestionType;
  score: number;
  /** Face expression type for SVG rendering */
  expression: 'happy' | 'calm' | 'neutral' | 'sad' | 'angry' | 'anxious';
}

export const MOODS: MoodDefinition[] = [
  {
    type: 'happy',
    emoji: '😊',
    label: 'Happy',
    color: '#FFD166',
    bgColor: '#E6B84D',
    faceColor: '#FFF0C0',
    gradient: ['#FFD166', '#E6B84D'],
    suggestion: 'gratitude',
    score: 9,
    expression: 'happy',
  },
  {
    type: 'calm',
    emoji: '😌',
    label: 'Calm',
    color: '#6BCB77',
    bgColor: '#4DAF58',
    faceColor: '#B5E8BB',
    gradient: ['#6BCB77', '#4DAF58'],
    suggestion: 'reflection',
    score: 8,
    expression: 'calm',
  },
  {
    type: 'focused',
    emoji: '🎯',
    label: 'Focused',
    color: '#4ECDC4',
    bgColor: '#38B2A8',
    faceColor: '#A0E8E0',
    gradient: ['#4ECDC4', '#38B2A8'],
    suggestion: 'productivity',
    score: 7,
    expression: 'neutral',
  },
  {
    type: 'peaceful',
    emoji: '🧘',
    label: 'Peaceful',
    color: '#95E1D3',
    bgColor: '#6EC4B5',
    faceColor: '#C5F0E8',
    gradient: ['#95E1D3', '#6EC4B5'],
    suggestion: 'meditation',
    score: 8,
    expression: 'calm',
  },
  {
    type: 'motivated',
    emoji: '🔥',
    label: 'Motivated',
    color: '#FFBE6A',
    bgColor: '#E6A850',
    faceColor: '#FFE0A8',
    gradient: ['#FFBE6A', '#E6A850'],
    suggestion: 'productivity',
    score: 8,
    expression: 'happy',
  },
  {
    type: 'sad',
    emoji: '😢',
    label: 'Sad',
    color: '#74B9FF',
    bgColor: '#5A9FE6',
    faceColor: '#B0D8FF',
    gradient: ['#74B9FF', '#5A9FE6'],
    suggestion: 'calming_music',
    score: 3,
    expression: 'sad',
  },
  {
    type: 'tired',
    emoji: '😴',
    label: 'Tired',
    color: '#A8A8B3',
    bgColor: '#6E6E78',
    faceColor: '#CDCDD4',
    gradient: ['#A8A8B3', '#6E6E78'],
    suggestion: 'rest',
    score: 4,
    expression: 'neutral',
  },
  {
    type: 'anxious',
    emoji: '😰',
    label: 'Anxious',
    color: '#C59CFF',
    bgColor: '#A57DE6',
    faceColor: '#DCC5FF',
    gradient: ['#C59CFF', '#A57DE6'],
    suggestion: 'grounding',
    score: 3,
    expression: 'anxious',
  },
  {
    type: 'angry',
    emoji: '😤',
    label: 'Angry',
    color: '#FF6B6B',
    bgColor: '#E65555',
    faceColor: '#FFB0B0',
    gradient: ['#FF6B6B', '#E65555'],
    suggestion: 'pause_timer',
    score: 2,
    expression: 'angry',
  },
  {
    type: 'stressed',
    emoji: '😣',
    label: 'Stressed',
    color: '#FF8E8E',
    bgColor: '#E67575',
    faceColor: '#FFC5C5',
    gradient: ['#FF8E8E', '#E67575'],
    suggestion: 'breathing',
    score: 3,
    expression: 'anxious',
  },
];

export const MOOD_MAP = Object.fromEntries(
  MOODS.map((m) => [m.type, m])
) as Record<MoodType, MoodDefinition>;

export const getMoodByType = (type: MoodType): MoodDefinition => MOOD_MAP[type];
