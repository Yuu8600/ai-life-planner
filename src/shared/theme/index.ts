import { clearLightPalette } from './palette';
export { clearLightPalette } from './palette';
export type { SemanticPalette } from './palette';
export { controls, radius, spacing, surfaces, typography } from './tokens';
export { clearLightTheme, ThemeProvider, useTheme } from './ThemeProvider';
export type { AppTheme } from './ThemeProvider';

/** Static light compatibility aliases for screens that migrate in Step 9C. */
export const colors = {
  ...clearLightPalette,
  text: clearLightPalette.textPrimary,
  textMuted: clearLightPalette.textSecondary,
  textSubtle: clearLightPalette.textSecondary,
  accent: clearLightPalette.primary,
  accentPressed: clearLightPalette.primaryPressed,
  accentSoft: clearLightPalette.primarySoft,
  accentMuted: clearLightPalette.primaryBorder,
  border: clearLightPalette.borderSubtle,
};
