/**
 * MoodMap Layout System
 * Spacing, radius, shadows, and tab bar dimensions
 */

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
  screen: 48,
} as const;

export const Radius = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 26,
  card: 24,
  button: 16,
  chip: 20,
  input: 16,
  pill: 9999,
  full: 9999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  }),
} as const;

/** Standard screen horizontal padding */
export const SCREEN_PADDING = Spacing.xl;

/** Floating tab bar */
export const TAB_BAR_HEIGHT = 78;
export const TAB_BAR_MARGIN = 16;
export const TAB_BAR_RADIUS = 40;
export const FAB_SIZE = 64;

/** Animation durations in ms */
export const Durations = {
  instant: 100,
  fast: 150,
  normal: 250,
  slow: 400,
  verySlow: 600,
  splash: 1500,
} as const;
