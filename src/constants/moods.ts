/**
 * MoodMap — Mood Definitions (Freud-Inspired Earthy Palette)
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
    color: '#D4A843',
    bgColor: '#D4A843',
    faceColor: '#EDD9A8',
    gradient: ['#D4A843', '#C49A38'],
    suggestion: 'gratitude',
    score: 9,
    expression: 'happy',
  },
  {
    type: 'calm',
    emoji: '😌',
    label: 'Calm',
    color: '#A8B572',
    bgColor: '#7D9B5A',
    faceColor: '#C5D4A0',
    gradient: ['#A8B572', '#8FA05E'],
    suggestion: 'reflection',
    score: 8,
    expression: 'calm',
  },
  {
    type: 'focused',
    emoji: '🎯',
    label: 'Focused',
    color: '#7D9B5A',
    bgColor: '#5A7D5A',
    faceColor: '#A0C4A0',
    gradient: ['#7D9B5A', '#6B8A4A'],
    suggestion: 'productivity',
    score: 7,
    expression: 'neutral',
  },
  {
    type: 'peaceful',
    emoji: '🧘',
    label: 'Peaceful',
    color: '#8BA88A',
    bgColor: '#6B8B6B',
    faceColor: '#B0CCB0',
    gradient: ['#8BA88A', '#7A9A7A'],
    suggestion: 'meditation',
    score: 8,
    expression: 'calm',
  },
  {
    type: 'motivated',
    emoji: '🔥',
    label: 'Motivated',
    color: '#D4A843',
    bgColor: '#A8B572',
    faceColor: '#D4D8A0',
    gradient: ['#D4A843', '#C49A38'],
    suggestion: 'productivity',
    score: 8,
    expression: 'happy',
  },
  {
    type: 'sad',
    emoji: '😢',
    label: 'Sad',
    color: '#C67B4E',
    bgColor: '#D4845A',
    faceColor: '#E8B9A0',
    gradient: ['#D4845A', '#C07048'],
    suggestion: 'calming_music',
    score: 3,
    expression: 'sad',
  },
  {
    type: 'tired',
    emoji: '😴',
    label: 'Tired',
    color: '#6B5E50',
    bgColor: '#8B7355',
    faceColor: '#A89880',
    gradient: ['#8B7355', '#7A6548'],
    suggestion: 'rest',
    score: 4,
    expression: 'neutral',
  },
  {
    type: 'anxious',
    emoji: '😰',
    label: 'Anxious',
    color: '#9B7DB8',
    bgColor: '#8B6B9B',
    faceColor: '#C4A8D4',
    gradient: ['#9B7DB8', '#8A6CA8'],
    suggestion: 'grounding',
    score: 3,
    expression: 'anxious',
  },
  {
    type: 'angry',
    emoji: '😤',
    label: 'Angry',
    color: '#C45C4A',
    bgColor: '#C45C4A',
    faceColor: '#E0A090',
    gradient: ['#C45C4A', '#B04A3A'],
    suggestion: 'pause_timer',
    score: 2,
    expression: 'angry',
  },
  {
    type: 'stressed',
    emoji: '😣',
    label: 'Stressed',
    color: '#B86B6B',
    bgColor: '#B86B6B',
    faceColor: '#D4A0A0',
    gradient: ['#B86B6B', '#A85A5A'],
    suggestion: 'breathing',
    score: 3,
    expression: 'anxious',
  },
];

export const MOOD_MAP = Object.fromEntries(
  MOODS.map((m) => [m.type, m])
) as Record<MoodType, MoodDefinition>;

export const getMoodByType = (type: MoodType): MoodDefinition => MOOD_MAP[type];
