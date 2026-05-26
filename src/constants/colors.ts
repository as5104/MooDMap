/**
 * MoodMap Color System
 * Premium dark theme with teal/yellow accent palette
 */

export const Colors = {
  // === Base Backgrounds ===
  background: {
    primary: '#000814',
    secondary: '#001D3D',
    card: '#0A1020',
    cardHover: '#0F1A30',
    elevated: '#122040',
    input: '#0D1525',
  },

  // === Gradient Stops ===
  gradient: {
    top: '#000814',
    middle: '#003566',
    bottom: '#001D3D',
    glow: 'rgba(25, 199, 184, 0.15)',
    glowStrong: 'rgba(25, 199, 184, 0.25)',
  },

  // === Accent Colors ===
  accent: {
    primary: '#FFD60A',
    primaryDark: '#F4C542',
    primaryMuted: 'rgba(255, 214, 10, 0.15)',
    secondary: '#0B4D8A',
    teal: '#19C7B8',
    tealMuted: 'rgba(25, 199, 184, 0.15)',
    green: '#6EE7A8',
  },

  // === Text ===
  text: {
    primary: '#F5F7FA',
    secondary: '#A0AEC0',
    tertiary: '#5A6B80',
    onAccent: '#000814',
    onTeal: '#000814',
  },

  // === Mood Colors ===
  mood: {
    happy: '#FFD60A',
    calm: '#19C7B8',
    focused: '#0B4D8A',
    peaceful: '#6EE7A8',
    sad: '#6C7A89',
    tired: '#4A5568',
    anxious: '#7C5CFC',
    angry: '#FF6B6B',
    stressed: '#E85D75',
    motivated: '#00D9FF',
  } as Record<string, string>,

  // === Semantic ===
  success: '#6EE7A8',
  warning: '#FFD60A',
  error: '#FF6B6B',
  info: '#19C7B8',

  // === Borders & Shadows ===
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    medium: 'rgba(255, 255, 255, 0.12)',
    accent: 'rgba(25, 199, 184, 0.3)',
    accentStrong: 'rgba(25, 199, 184, 0.5)',
  },

  // === Overlays ===
  overlay: {
    light: 'rgba(0, 8, 20, 0.5)',
    medium: 'rgba(0, 8, 20, 0.7)',
    heavy: 'rgba(0, 8, 20, 0.9)',
  },
} as const;

export type MoodColorKey = keyof typeof Colors.mood;
