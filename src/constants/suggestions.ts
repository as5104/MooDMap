/**
 * MoodMap — Activity Recommendation Engine
 * Maps every mood, stress level, and energy state to our full suite of mindful activities
 */

import { type MoodType, type SuggestionType } from './moods';
import { Feather } from '@expo/vector-icons';

export interface Suggestion {
  type: SuggestionType;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  route: string;
  badge: string;
  actionText?: string;
}

export const SUGGESTION_MAP: Record<MoodType, Suggestion> = {
  stressed: {
    type: 'breathing',
    title: 'Mindful Breathing Reset',
    subtitle: 'A 4-7-8 calming pattern to lower cortisol and soothe your mind',
    icon: 'wind',
    color: '#38BDF8', // Sky Blue / Cyan
    route: '/breathing',
    badge: 'Calm',
    actionText: 'Start Breathing',
  },
  anxious: {
    type: 'grounding',
    title: '5-4-3-2-1 Sensory Grounding',
    subtitle: 'Anchor your 5 senses to the present moment and dissolve panic',
    icon: 'anchor',
    color: '#C084FC', // Lavender Violet
    route: '/grounding',
    badge: 'Sensory',
    actionText: 'Start Grounding',
  },
  sad: {
    type: 'comfort_box',
    title: 'Open Your Comfort Box',
    subtitle: 'Surround yourself with soothing memories, audio & calming notes',
    icon: 'package',
    color: '#F472B6', // Rose Pink
    route: '/comfort-box',
    badge: 'Soothing',
    actionText: 'Open Sanctuary',
  },
  angry: {
    type: 'pause_timer',
    title: 'Take a Mindful Pause',
    subtitle: 'Step away for a 3-minute breath break to reset with clarity',
    icon: 'clock',
    color: '#FB7185', // Warm Coral
    route: '/pause-timer',
    badge: 'Timer',
    actionText: 'Start Pause',
  },
  tired: {
    type: 'calming_music',
    title: 'Soothing Soundscapes',
    subtitle: 'Unwind and recharge with ambient audio, nature & soft lo-fi',
    icon: 'music',
    color: '#60A5FA', // Azure Blue
    route: '/music',
    badge: 'Audio',
    actionText: 'Listen Now',
  },
  happy: {
    type: 'gratitude',
    title: 'Count 3 Blessings',
    subtitle: 'Lock in your joy by noting 3 things you are grateful for today',
    icon: 'heart',
    color: '#FBBF24', // Golden Amber
    route: '/gratitude',
    badge: 'Joy',
    actionText: 'Note Gratitude',
  },
  focused: {
    type: 'memory_matrix',
    title: 'Memory Matrix Recall',
    subtitle: 'Sharpen your cognitive recall and test your visual memory',
    icon: 'grid',
    color: '#34D399', // Emerald
    route: '/memory-matrix',
    badge: 'Focus',
    actionText: 'Play Matrix',
  },
  motivated: {
    type: 'letters',
    title: 'Write a Time Capsule Letter',
    subtitle: 'Bottle your peak drive and send an empowering note to Future You',
    icon: 'mail',
    color: '#A78BFA', // Purple
    route: '/letters',
    badge: 'Capsule',
    actionText: 'Write Letter',
  },
  calm: {
    type: 'reflection',
    title: 'Ponder a Reflection',
    subtitle: 'Explore a thought-provoking prompt while your mind is still',
    icon: 'message-circle',
    color: '#2DD4BF', // Teal
    route: '/reflection',
    badge: 'Reflect',
    actionText: 'Reflect Now',
  },
  peaceful: {
    type: 'journal',
    title: 'Pen a Peaceful Journal',
    subtitle: 'Capture the quiet serenity of this moment in your journal',
    icon: 'edit-3',
    color: '#BEFF6C', // Lime
    route: '/journal-editor',
    badge: 'Journal',
    actionText: 'Write Entry',
  },
};

/**
 * Get a suggestion based on mood, stress level, and energy level.
 * Handles high stress overrides and energy nuances.
 */
export const getSuggestion = (
  moodType: MoodType,
  stressLevel?: number,
  energyLevel?: number
): Suggestion => {
  // High stress (level 4-5) overrides any state to instant 4-7-8 Breathing
  if (stressLevel && stressLevel >= 4) {
    return {
      type: 'breathing',
      title: 'High Stress Detected — Breathe',
      subtitle: 'Take 2 minutes to breathe with 4-7-8 and immediately ease tension',
      icon: 'wind',
      color: '#38BDF8',
      route: '/breathing',
      badge: 'Stress Relief',
      actionText: 'Start Breathing',
    };
  }

  // Low energy (1-2) with anxiousness -> Gentle Sensory Grounding
  if (moodType === 'anxious' && energyLevel && energyLevel <= 2) {
    return {
      type: 'grounding',
      title: 'Gentle 5-4-3-2-1 Grounding',
      subtitle: 'A quiet sensory anchor to steady your mind without draining energy',
      icon: 'anchor',
      color: '#C084FC',
      route: '/grounding',
      badge: 'Gentle Anchor',
      actionText: 'Start Grounding',
    };
  }

  // Sad with high energy -> Expressive Writing / Comfort
  if (moodType === 'sad' && energyLevel && energyLevel >= 4) {
    return {
      type: 'letters',
      title: 'Write a Healing Letter',
      subtitle: 'Release heavy emotions by penning a compassionate letter to yourself',
      icon: 'mail',
      color: '#F472B6',
      route: '/letters',
      badge: 'Healing',
      actionText: 'Write Letter',
    };
  }

  // Motivated with high focus -> Cognitive Memory Matrix
  if (moodType === 'motivated' && energyLevel && energyLevel >= 4) {
    return {
      type: 'memory_matrix',
      title: 'Test Your Focus & Memory',
      subtitle: 'Channel your energized state into a high-scoring cognitive recall game',
      icon: 'grid',
      color: '#34D399',
      route: '/memory-matrix',
      badge: 'Focus Challenge',
      actionText: 'Play Matrix',
    };
  }

  return SUGGESTION_MAP[moodType] ?? SUGGESTION_MAP.calm;
};

export const ALL_SUGGESTIONS = SUGGESTION_MAP;
