/**
 * MoodMap — Rule-Based Suggestion Definitions (Premium Palette)
 */

import { type MoodType, type SuggestionType } from './moods';

export interface Suggestion {
  type: SuggestionType;
  title: string;
  subtitle: string;
  icon: string; // Feather icon name
  color: string;
  route?: string; // Navigation target
}

const SUGGESTION_MAP: Record<MoodType, Suggestion> = {
  stressed: {
    type: 'breathing',
    title: 'Try a breathing exercise',
    subtitle: 'A 4-7-8 breathing pattern can help calm your mind',
    icon: 'wind',
    color: '#FF8E8E',
    route: '/activities',
  },
  sad: {
    type: 'calming_music',
    title: 'Listen to something calming',
    subtitle: 'Ambient sounds can help soothe your mood',
    icon: 'music',
    color: '#74B9FF',
    route: '/sound-player',
  },
  tired: {
    type: 'rest',
    title: 'Take a rest break',
    subtitle: 'Even a 5-minute pause can help recharge you',
    icon: 'moon',
    color: '#A8A8B3',
    route: '/activities',
  },
  anxious: {
    type: 'grounding',
    title: 'Try a grounding exercise',
    subtitle: 'The 5-4-3-2-1 technique brings you back to the present',
    icon: 'anchor',
    color: '#C59CFF',
    route: '/activities',
  },
  happy: {
    type: 'gratitude',
    title: 'Capture what made you smile',
    subtitle: 'Write a quick gratitude note to remember this feeling',
    icon: 'heart',
    color: '#FFD166',
    route: '/journal-editor',
  },
  angry: {
    type: 'pause_timer',
    title: 'Take a pause',
    subtitle: 'A short break can help you process your feelings',
    icon: 'pause-circle',
    color: '#FF6B6B',
    route: '/activities',
  },
  calm: {
    type: 'reflection',
    title: 'Write a reflection',
    subtitle: 'Capture this peaceful moment in your journal',
    icon: 'edit-3',
    color: '#6BCB77',
    route: '/journal-editor',
  },
  focused: {
    type: 'productivity',
    title: 'Ride the wave!',
    subtitle: 'You\'re in the zone — make the most of it',
    icon: 'zap',
    color: '#4ECDC4',
  },
  peaceful: {
    type: 'meditation',
    title: 'Enjoy a short meditation',
    subtitle: 'Deepen this sense of peace with a few mindful moments',
    icon: 'sun',
    color: '#95E1D3',
    route: '/activities',
  },
  motivated: {
    type: 'share_win',
    title: 'Celebrate your energy!',
    subtitle: 'Journal about what\'s driving you today',
    icon: 'award',
    color: '#FFBE6A',
    route: '/journal-editor',
  },
};

/**
 * Get a suggestion based on mood and optional stress level
 * High stress overrides the mood-based suggestion
 */
export const getSuggestion = (
  moodType: MoodType,
  stressLevel?: number
): Suggestion => {
  if (stressLevel && stressLevel >= 4) {
    return {
      ...SUGGESTION_MAP.stressed,
      title: 'You seem stressed — try breathing',
      subtitle: 'Take a moment to breathe deeply and reset',
    };
  }
  return SUGGESTION_MAP[moodType];
};

export const ALL_SUGGESTIONS = SUGGESTION_MAP;
