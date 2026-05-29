/**
 * MoodMap Color System — Premium Dark Mode
 * Deep blacks, vivid lime accent, frosted glass, cool neutrals
 */

export const Colors = {
  // Base Backgrounds (true dark)
  background: {
    primary: '#0A0A0C',
    secondary: '#0F0F12',
    card: '#1A1A1F',
    cardHover: '#222228',
    elevated: '#22222A',
    input: '#14141A',
    light: '#F5F5F7',
  },

  // Gradient Stops
  gradient: {
    top: '#0A0A0C',
    middle: '#0F0F12',
    bottom: '#0A0A0C',
    glow: 'rgba(190, 255, 108, 0.08)',
    glowStrong: 'rgba(190, 255, 108, 0.16)',
  },

  // Frosted Glass
  glass: {
    bg: 'rgba(255, 255, 255, 0.06)',
    bgStrong: 'rgba(255, 255, 255, 0.10)',
    bgSubtle: 'rgba(255, 255, 255, 0.03)',
    border: 'rgba(255, 255, 255, 0.12)',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
  },

  // Accent Colors
  accent: {
    primary: '#BEFF6C',
    primaryDark: '#9EDD4C',
    primaryMuted: 'rgba(190, 255, 108, 0.15)',
    lavender: '#B8A9FF',
    lavenderMuted: 'rgba(184, 169, 255, 0.15)',
    coral: '#FF7A6E',
    coralMuted: 'rgba(255, 122, 110, 0.15)',
    amber: '#FFBE6A',
    amberMuted: 'rgba(255, 190, 106, 0.15)',
    cream: '#FFFFFF',
    creamMuted: 'rgba(255, 255, 255, 0.08)',
    // Legacy aliases (kept for backward compat during migration)
    olive: '#BEFF6C',
    oliveDark: '#9EDD4C',
    oliveMuted: 'rgba(190, 255, 108, 0.15)',
    brown: '#B8A9FF',
    brownMuted: 'rgba(184, 169, 255, 0.15)',
    terracotta: '#FF7A6E',
    terracottaMuted: 'rgba(255, 122, 110, 0.15)',
    golden: '#FFBE6A',
    goldenMuted: 'rgba(255, 190, 106, 0.15)',
  },

  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#8E8E93',
    tertiary: '#48484E',
    onDark: '#FFFFFF',
    onLight: '#0A0A0C',
    onAccent: '#0A0A0C',
  },

  // Mood Colors (vibrant, saturated)
  mood: {
    happy: '#FFD166',
    calm: '#6BCB77',
    focused: '#4ECDC4',
    peaceful: '#95E1D3',
    sad: '#74B9FF',
    tired: '#A8A8B3',
    anxious: '#C59CFF',
    angry: '#FF6B6B',
    stressed: '#FF8E8E',
    motivated: '#FFBE6A',
  } as Record<string, string>,

  // Mood Full-Screen Backgrounds (slightly deeper)
  moodBg: {
    happy: '#E6B84D',
    calm: '#4DAF58',
    focused: '#38B2A8',
    peaceful: '#6EC4B5',
    sad: '#5A9FE6',
    tired: '#6E6E78',
    anxious: '#A57DE6',
    angry: '#E65555',
    stressed: '#E67575',
    motivated: '#E6A850',
  } as Record<string, string>,

  // Mood Face Circle Colors (lighter tint)
  moodFace: {
    happy: '#FFF0C0',
    calm: '#B5E8BB',
    focused: '#A0E8E0',
    peaceful: '#C5F0E8',
    sad: '#B0D8FF',
    tired: '#CDCDD4',
    anxious: '#DCC5FF',
    angry: '#FFB0B0',
    stressed: '#FFC5C5',
    motivated: '#FFE0A8',
  } as Record<string, string>,

  // Semantic
  success: '#6BCB77',
  warning: '#FFBE6A',
  error: '#FF6B6B',
  info: '#74B9FF',

  // Metric Card Colors (deep, saturated)
  metric: {
    green: '#2D7D46',
    orange: '#E87040',
    brown: '#2A2A35',
    olive: '#3D8B5A',
  },

  // Borders & Shadows
  border: {
    subtle: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.14)',
    accent: 'rgba(190, 255, 108, 0.3)',
    accentStrong: 'rgba(190, 255, 108, 0.5)',
  },

  // Overlays
  overlay: {
    light: 'rgba(10, 10, 12, 0.5)',
    medium: 'rgba(10, 10, 12, 0.7)',
    heavy: 'rgba(10, 10, 12, 0.9)',
  },
} as const;

export type MoodColorKey = keyof typeof Colors.mood;
