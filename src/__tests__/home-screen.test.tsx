import { render } from '@testing-library/react-native';

import HomeScreen from '../app/index';

describe('HomeScreen', () => {
  it('renders the initial Milestone 0 screen', async () => {
    const screen = await render(<HomeScreen />);

    expect(screen.getByText('AI Life Planner')).toBeTruthy();
    expect(screen.getByText('Milestone 0 のセットアップが完了しました。')).toBeTruthy();
  });
});
