import { StatePanel, type StatePanelProps } from '@/shared/components/StatePanel';

export function TodayStatePanel(props: Omit<StatePanelProps, 'loadingLabel'>) {
  return <StatePanel {...props} loadingLabel="今日の予定を読み込み中" />;
}
