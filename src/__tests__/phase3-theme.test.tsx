import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  ThemeProvider,
  clearDarkTheme,
  clearLightPalette,
  clearDarkPalette,
  useTheme,
} from '@/shared/theme';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { FormInput } from '@/shared/components/FormField';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockScheme,
}));
beforeEach(() => {
  mockScheme = 'light';
});

function Probe() {
  const { name } = useTheme();
  return <Text>{name}</Text>;
}
it('keeps light as the default until full-screen migration enables OS following', async () => {
  const screen = await render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  expect(screen.getByText('clear-light')).toBeTruthy();
});
it('supplies all semantic roles and updates common inputs and headers across themes', async () => {
  expect(Object.keys(clearDarkPalette).sort()).toEqual(Object.keys(clearLightPalette).sort());
  const screen = await render(
    <ThemeProvider theme={clearDarkTheme}>
      <ScreenHeader title="見出し" />
      <FormInput accessibilityLabel="入力" />
    </ThemeProvider>,
  );
  expect(screen.getByText('見出し')).toHaveStyle({ color: clearDarkPalette.textPrimary });
  expect(screen.getByLabelText('入力')).toHaveStyle({
    color: clearDarkPalette.textPrimary,
    backgroundColor: clearDarkPalette.inputSurface,
  });
  await screen.rerender(
    <ThemeProvider>
      <ScreenHeader title="見出し" />
      <FormInput accessibilityLabel="入力" />
    </ThemeProvider>,
  );
  expect(screen.getByText('見出し')).toHaveStyle({ color: clearLightPalette.textPrimary });
});

it('follows OS changes when enabled without a saved theme preference', async () => {
  mockScheme = 'dark';
  const screen = await render(
    <ThemeProvider followSystem>
      <Probe />
    </ThemeProvider>,
  );
  expect(screen.getByText('clear-dark')).toBeTruthy();
  mockScheme = 'light';
  await screen.rerender(
    <ThemeProvider followSystem>
      <Probe />
    </ThemeProvider>,
  );
  expect(screen.getByText('clear-light')).toBeTruthy();
});

it('keeps readable text and status contrast in both palettes', () => {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  for (const palette of [clearLightPalette, clearDarkPalette]) {
    for (const [foreground, background] of [
      [palette.textPrimary, palette.surface],
      [palette.textSecondary, palette.background],
      [palette.onPrimary, palette.primary],
      [palette.onError, palette.error],
      [palette.success, palette.successSoft],
      [palette.warning, palette.warningSoft],
    ]) {
      const a = luminance(foreground),
        b = luminance(background);
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  }
});
