import { render } from '@testing-library/react-native';

import { TodayScreen } from '@/features/today/TodayScreen';

describe('TodayScreen', () => {
  it('renders the key parts of today’s plan', async () => {
    const screen = await render(<TodayScreen onPressAi={jest.fn()} onPressSettings={jest.fn()} />);

    expect(screen.getByText('2026年9月11日 金曜日')).toBeTruthy();
    expect(screen.getByText('おはようございます')).toBeTruthy();
    expect(screen.getByText('今日のタイムライン')).toBeTruthy();
    expect(screen.getByText('大学')).toBeTruthy();
    expect(screen.getByText('Part 5')).toBeTruthy();
    expect(screen.getByLabelText('今日の完了数 1件、全3件')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'AIに今日の計画を相談する' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '設定を開く' })).toBeTruthy();
  });
});
