import { createContext, useContext, type ReactNode } from 'react';
import { clearLightPalette, type SemanticPalette } from './palette';
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
const ThemeContext = createContext<AppTheme>(clearLightTheme);
/** Only light is shipped. New common components obtain all appearance values here. */
export function ThemeProvider({
  children,
  theme = clearLightTheme,
}: {
  children: ReactNode;
  theme?: AppTheme;
}) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
