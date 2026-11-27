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
