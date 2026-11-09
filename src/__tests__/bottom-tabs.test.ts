import { getBottomTabLayout, SIDEBAR_MIN_WIDTH, TAB_CONFIG } from '@/shared/navigation/tabs';

describe('Primary navigation', () => {
  it('preserves route identifiers and order while showing Japanese labels', () => {
    expect(Object.keys(TAB_CONFIG)).toEqual(['today', 'goals', 'tasks', 'calendar', 'ai']);
    expect(Object.values(TAB_CONFIG).map((tab) => tab.title)).toEqual([
      '今日',
      '目標',
      'タスク',
      '予定',
      '計画',
    ]);
    for (const tab of Object.values(TAB_CONFIG)) {
      expect(tab.accessibilityLabel).toBe(`${tab.title}タブ`);
    }
  });

  it('uses a taller bottom bar at 214% and keeps its visual labels at 375pt', () => {
    const normal = getBottomTabLayout(375, 1);
    const enlarged = getBottomTabLayout(375, 2.143);
    expect(enlarged.showLabels).toBe(true);
    expect(enlarged.height).toBeGreaterThan(normal.height);
  });

  it('uses icons at the largest size if labels will not fit, with room for labels on wider screens', () => {
    expect(getBottomTabLayout(375, 3.1).showLabels).toBe(false);
    expect(getBottomTabLayout(720, 3.1).showLabels).toBe(true);
    expect(SIDEBAR_MIN_WIDTH).toBe(1024);
  });
});
