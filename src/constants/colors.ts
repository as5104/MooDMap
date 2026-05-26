/**
 * MoodMap Color System — Freud-Inspired Earthy Warm Palette
 * Warm charcoal, olive green, terracotta, golden brown
 */

export const Colors = {
  // === Base Backgrounds (warm charcoal) ===
  background: {
    primary: '#1A1612',
    secondary: '#211D17',
    card: '#2A2520',
    cardHover: '#322D27',
    elevated: '#342F28',
    input: '#252017',
    light: '#F5F0E8',
  },

  // === Gradient Stops ===
  gradient: {
    top: '#1A1612',
    middle: '#211D17',
    bottom: '#191510',
    glow: 'rgba(168, 181, 114, 0.12)',
    glowStrong: 'rgba(168, 181, 114, 0.22)',
  },

  // === Accent Colors ===
  accent: {
    olive: '#A8B572',
    oliveDark: '#8FA05E',
    oliveMuted: 'rgba(168, 181, 114, 0.15)',
    brown: '#8B7355',
    brownMuted: 'rgba(139, 115, 85, 0.15)',
    terracotta: '#D4845A',
    terracottaMuted: 'rgba(212, 132, 90, 0.15)',
    golden: '#D4A843',
    goldenMuted: 'rgba(212, 168, 67, 0.15)',
    cream: '#F0EBE3',
    creamMuted: 'rgba(240, 235, 227, 0.08)',
  },

  // === Text ===
  text: {
    primary: '#F0EBE3',
    secondary: '#9A8E7F',
    tertiary: '#6B5E50',
    onDark: '#F0EBE3',
    onLight: '#1A1612',
    onAccent: '#1A1612',
  },

  // === Mood Colors ===
  mood: {
    happy: '#D4A843',
    calm: '#A8B572',
    focused: '#7D9B5A',
    peaceful: '#8BA88A',
    sad: '#C67B4E',
    tired: '#6B5E50',
    anxious: '#9B7DB8',
    angry: '#C45C4A',
    stressed: '#B86B6B',
    motivated: '#D4A843',
  } as Record<string, string>,

  // === Mood Full-Screen Backgrounds ===
  moodBg: {
    happy: '#D4A843',
    calm: '#7D9B5A',
    focused: '#5A7D5A',
    peaceful: '#8BA88A',
    sad: '#D4845A',
    tired: '#6B5E50',
    anxious: '#8B6B9B',
    angry: '#C45C4A',
    stressed: '#B86B6B',
    motivated: '#A8B572',
  } as Record<string, string>,

  // === Mood Face Circle Colors (lighter tint of mood) ===
  moodFace: {
    happy: '#EDD9A8',
    calm: '#C5D4A0',
    focused: '#A0C4A0',
    peaceful: '#B0CCB0',
    sad: '#E8B9A0',
    tired: '#A89880',
    anxious: '#C4A8D4',
    angry: '#E0A090',
    stressed: '#D4A0A0',
    motivated: '#D4D8A0',
  } as Record<string, string>,

  // === Semantic ===
  success: '#A8B572',
  warning: '#D4A843',
  error: '#C45C4A',
  info: '#8B7355',

  // === Metric Card Colors ===
  metric: {
    green: '#5A7D5A',
    orange: '#D4845A',
    brown: '#6B5E50',
    olive: '#7D9B5A',
  },

  // === Borders & Shadows ===
  border: {
    subtle: 'rgba(240, 235, 227, 0.06)',
    medium: 'rgba(240, 235, 227, 0.12)',
    accent: 'rgba(168, 181, 114, 0.3)',
    accentStrong: 'rgba(168, 181, 114, 0.5)',
  },

  // === Overlays ===
  overlay: {
    light: 'rgba(26, 22, 18, 0.5)',
    medium: 'rgba(26, 22, 18, 0.7)',
    heavy: 'rgba(26, 22, 18, 0.9)',
  },
} as const;

export type MoodColorKey = keyof typeof Colors.mood;
