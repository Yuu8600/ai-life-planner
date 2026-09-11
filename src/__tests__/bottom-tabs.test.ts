import { TAB_CONFIG } from '@/shared/navigation/tabs';

describe('Bottom navigation', () => {
  it('defines the five primary tabs in the intended order', () => {
    expect(Object.values(TAB_CONFIG).map((tab) => tab.title)).toEqual([
      'Today',
      'Goals',
      'Tasks',
      'Calendar',
      'AI',
    ]);
  });
});
