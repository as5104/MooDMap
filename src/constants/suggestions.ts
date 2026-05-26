/**
 * MoodMap — Rule-Based Suggestion Definitions
 * Maps moods to actionable suggestions (Freud-Inspired warm palette)
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
    color: '#B86B6B',
    route: '/activities',
  },
  sad: {
    type: 'calming_music',
    title: 'Listen to something calming',
    subtitle: 'Ambient sounds can help soothe your mood',
    icon: 'music',
    color: '#C67B4E',
    route: '/sound-player',
  },
  tired: {
    type: 'rest',
    title: 'Take a rest break',
    subtitle: 'Even a 5-minute pause can help recharge you',
    icon: 'moon',
    color: '#6B5E50',
    route: '/activities',
  },
  anxious: {
    type: 'grounding',
    title: 'Try a grounding exercise',
    subtitle: 'The 5-4-3-2-1 technique brings you back to the present',
    icon: 'anchor',
    color: '#9B7DB8',
    route: '/activities',
  },
  happy: {
    type: 'gratitude',
    title: 'Capture what made you smile',
    subtitle: 'Write a quick gratitude note to remember this feeling',
    icon: 'heart',
    color: '#D4A843',
    route: '/journal-editor',
  },
  angry: {
    type: 'pause_timer',
    title: 'Take a pause',
    subtitle: 'A short break can help you process your feelings',
    icon: 'pause-circle',
    color: '#C45C4A',
    route: '/activities',
  },
  calm: {
    type: 'reflection',
    title: 'Write a reflection',
    subtitle: 'Capture this peaceful moment in your journal',
    icon: 'edit-3',
    color: '#A8B572',
    route: '/journal-editor',
  },
  focused: {
    type: 'productivity',
    title: 'Ride the wave!',
    subtitle: 'You\'re in the zone — make the most of it',
    icon: 'zap',
    color: '#7D9B5A',
  },
  peaceful: {
    type: 'meditation',
    title: 'Enjoy a short meditation',
    subtitle: 'Deepen this sense of peace with a few mindful moments',
    icon: 'sun',
    color: '#8BA88A',
    route: '/activities',
  },
  motivated: {
    type: 'share_win',
    title: 'Celebrate your energy!',
    subtitle: 'Journal about what\'s driving you today',
    icon: 'award',
    color: '#D4A843',
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
