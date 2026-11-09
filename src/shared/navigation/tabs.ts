export const TAB_CONFIG = {
  today: { title: '今日', accessibilityLabel: '今日タブ' },
  goals: { title: '目標', accessibilityLabel: '目標タブ' },
  tasks: { title: 'タスク', accessibilityLabel: 'タスクタブ' },
  calendar: { title: '予定', accessibilityLabel: '予定タブ' },
  ai: { title: '計画', accessibilityLabel: '計画タブ' },
} as const;

export const SIDEBAR_MIN_WIDTH = 1024;
export const TAB_LABEL_SIZE = 12;

export function getBottomTabLayout(availableWidth: number, fontScale: number) {
  const labelWidth = availableWidth / Object.keys(TAB_CONFIG).length - 10;
  const charactersPerLine = Math.max(1, Math.floor(labelWidth / (TAB_LABEL_SIZE * fontScale)));
  const lines = Math.ceil(3 / charactersPerLine);
  // Keep the accessible name and Large Content Viewer when the labels would
  // take more space than a compact bar can offer at the largest text sizes.
  const showLabels = fontScale <= 2.6 || lines === 1;
  return {
    showLabels,
    height: showLabels ? Math.max(58, 38 + Math.ceil(17 * fontScale * lines)) : 56,
  };
}
