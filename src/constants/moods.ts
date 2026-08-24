/**
 * MoodMap - Mood Definitions (Premium Palette)
 * Each mood has a type, icon, label, color, bgColor, faceColor, gradient, and suggestion
 */

export type MoodType =
  | 'happy' | 'calm' | 'focused' | 'peaceful'
  | 'sad' | 'tired' | 'anxious' | 'angry'
  | 'stressed' | 'motivated';

export type SuggestionType =
  | 'breathing' | 'calming_music' | 'reflection'
  | 'gratitude' | 'grounding' | 'pause_timer'
  | 'rest' | 'productivity' | 'meditation'
  | 'share_win' | 'memory_matrix' | 'letters'
  | 'comfort_box' | 'journal';

export interface MoodDefinition {
  type: MoodType;
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  faceColor: string;
  gradient: [string, string];
  suggestion: SuggestionType;
  score: number;
  expression: 'happy' | 'calm' | 'neutral' | 'sad' | 'angry' | 'anxious';
}

export const MOODS: MoodDefinition[] = [
  {
    type: 'happy',
    icon: 'smile',
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
    icon: 'sun',
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
    icon: 'target',
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
    icon: 'moon',
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
    icon: 'zap',
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
    icon: 'cloud-rain',
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
    icon: 'battery',
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
    icon: 'alert-circle',
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
    icon: 'alert-triangle',
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
    icon: 'activity',
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
