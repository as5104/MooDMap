/**
 * MoodMap Typography System — Poppins + Sora
 * Sora for headings (geometric, modern) + Poppins for body (clean, rounded)
 */

export const Fonts = {
  heading: 'Sora_700Bold',
  subheading: 'Sora_600SemiBold',
  body: 'Poppins_400Regular',
  bodyMedium: 'Poppins_500Medium',
  bodySemiBold: 'Poppins_600SemiBold',
  bodyBold: 'Poppins_700Bold',
} as const;

export const FontSizes = {
  hero: 32,
  h1: 28,
  h2: 22,
  h3: 18,
  body: 15,
  bodySmall: 13,
  caption: 11,
  tiny: 10,
} as const;

export const LineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;

/**
 * Pre-built text style presets
 */
export const TextStyles = {
  hero: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.hero,
    lineHeight: FontSizes.hero * LineHeights.tight,
  },
  h1: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h1,
    lineHeight: FontSizes.h1 * LineHeights.tight,
  },
  h2: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h2,
    lineHeight: FontSizes.h2 * LineHeights.tight,
  },
  h3: {
    fontFamily: Fonts.subheading,
    fontSize: FontSizes.h3,
    lineHeight: FontSizes.h3 * LineHeights.normal,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.body,
    lineHeight: FontSizes.body * LineHeights.normal,
  },
  bodyMedium: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.body,
    lineHeight: FontSizes.body * LineHeights.normal,
  },
  bodySemiBold: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.body,
    lineHeight: FontSizes.body * LineHeights.normal,
  },
  bodySmall: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    lineHeight: FontSizes.bodySmall * LineHeights.normal,
  },
  caption: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.caption,
    lineHeight: FontSizes.caption * LineHeights.normal,
  },
  tiny: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.tiny,
    lineHeight: FontSizes.tiny * LineHeights.normal,
  },
} as const;
