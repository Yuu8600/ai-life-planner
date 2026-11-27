import { useColorScheme } from 'react-native';
import { createContext, useContext, type ReactNode } from 'react';
import { clearDarkPalette, clearLightPalette, type SemanticPalette } from './palette';
import { controls, radius, spacing, surfaces, typography } from './tokens';

export type AppTheme = {
  name: string;
  colors: SemanticPalette;
  controls: typeof controls;
  radius: typeof radius;
  spacing: typeof spacing;
  surfaces: typeof surfaces;
  typography: typeof typography;
};
export const clearLightTheme: AppTheme = {
  name: 'clear-light',
  colors: clearLightPalette,
  controls,
  radius,
  spacing,
  surfaces,
  typography,
};
export const clearDarkTheme: AppTheme = {
  ...clearLightTheme,
  name: 'clear-dark',
  colors: clearDarkPalette,
};
const ThemeContext = createContext<AppTheme>(clearLightTheme);
/** OS appearance stays opt-in until all screens have migrated. */
export function ThemeProvider({
  children,
  theme,
  followSystem = false,
}: {
  children: ReactNode;
  theme?: AppTheme;
  followSystem?: boolean;
}) {
  const scheme = useColorScheme();
  const resolved = theme ?? (followSystem && scheme === 'dark' ? clearDarkTheme : clearLightTheme);
  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);

/** Compatibility roles for older screens, resolved from the active context. */
export function useThemeColors() {
  const { colors } = useTheme();
  return {
    ...colors,
    text: colors.textPrimary,
    textMuted: colors.textSecondary,
    textSubtle: colors.textSecondary,
    accent: colors.primary,
    accentPressed: colors.primaryPressed,
    accentSoft: colors.primarySoft,
    accentMuted: colors.primaryBorder,
    border: colors.borderSubtle,
  };
}
