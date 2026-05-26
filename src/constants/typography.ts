/**
 * MoodMap Typography System
 * Uses Inter (body) + Outfit (headings) from Google Fonts
 */

export const Fonts = {
  heading: 'Outfit_700Bold',
  subheading: 'Outfit_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const FontSizes = {
  hero: 32,
  h1: 28,
  h2: 22,
  h3: 18,
  body: 16,
  bodySmall: 14,
  caption: 12,
  tiny: 10,
} as const;

export const LineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;

/**
 * Pre-built text style presets for common use cases
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
