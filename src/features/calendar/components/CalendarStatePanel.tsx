import { StatePanel, type StatePanelProps } from '@/shared/components/StatePanel';

export function CalendarStatePanel(props: Omit<StatePanelProps, 'loadingLabel'>) {
  return <StatePanel {...props} loadingLabel="カレンダーを確認中" />;
}
