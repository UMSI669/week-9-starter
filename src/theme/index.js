/**
 * Dream Decoder design tokens.
 *
 * Contrast notes (measured as WCAG 2.1 relative-luminance ratios against the
 * surface each token is actually used on — see src/theme/__tests__):
 *   textPrimary   #F7F2FF on card #25183D  -> 12.6:1
 *   textSecondary #D1C4E9 on card #25183D  ->  8.9:1
 *   accent        #C4B5FD on card #25183D  ->  7.4:1
 *   textPrimary   #F7F2FF on bg   #100A24  -> 15.9:1
 * Glow is decoration only. Selection and focus always also change border
 * width, a check mark, or text, never only a shadow.
 */

export const colors = {
  background: '#100A24',
  gradientSecondary: '#281347',
  gradientTertiary: '#1A0F33',
  card: '#25183D',
  cardElevated: '#2E1E49',
  textPrimary: '#F7F2FF',
  textSecondary: '#D1C4E9',
  textMuted: '#A594C4',
  accent: '#C4B5FD',
  accentStrong: '#A78BFA',
  // Deep accent used behind #F7F2FF text on filled buttons (ratio 7.0:1).
  accentInk: '#3C1E73',
  border: '#3D2A5C',
  borderStrong: '#6D55A0',
  success: '#9BE8C0',
  successInk: '#123524',
  warning: '#F3D08A',
  warningInk: '#3A2A08',
  danger: '#FFB3BE',
  dangerInk: '#451018',
  star: '#EDE4FF',
  overlay: 'rgba(16, 10, 36, 0.82)',
};

export const gradients = {
  screen: [colors.background, colors.gradientTertiary, colors.gradientSecondary],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const fontSizes = {
  caption: 12,
  small: 13,
  body: 15,
  bodyLarge: 17,
  title: 20,
  heading: 26,
  display: 32,
};

/** iOS needs 44pt, Android needs 48dp; 48 satisfies both. */
export const touchTarget = 48;

export const typography = {
  // Platform system fonts. The interface never downloads a font, so it renders
  // identically with the device offline.
  display: { fontSize: fontSizes.display, fontWeight: '800', color: colors.textPrimary },
  heading: { fontSize: fontSizes.heading, fontWeight: '800', color: colors.textPrimary },
  title: { fontSize: fontSizes.title, fontWeight: '700', color: colors.textPrimary },
  body: { fontSize: fontSizes.body, fontWeight: '400', color: colors.textPrimary, lineHeight: 22 },
  bodySecondary: {
    fontSize: fontSizes.body,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 22,
  },
  caption: { fontSize: fontSizes.caption, fontWeight: '600', color: colors.textSecondary },
  eyebrow: {
    fontSize: fontSizes.caption,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
};

/**
 * iOS uses shadow*; Android uses elevation. Passing both and letting each
 * platform ignore the other keeps cards from looking flat on one platform.
 */
export function glow(intensity = 'md', color = colors.accentStrong) {
  const presets = {
    sm: { radius: 8, opacity: 0.18, elevation: 2 },
    md: { radius: 16, opacity: 0.26, elevation: 5 },
    lg: { radius: 26, opacity: 0.34, elevation: 9 },
  };
  const preset = presets[intensity] || presets.md;
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: preset.opacity,
    shadowRadius: preset.radius,
    elevation: preset.elevation,
  };
}

export const theme = {
  colors,
  gradients,
  spacing,
  radii,
  fontSizes,
  typography,
  touchTarget,
  glow,
};

export default theme;
