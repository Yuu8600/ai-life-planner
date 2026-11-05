import { StatePanel, type StatePanelProps } from '@/shared/components/StatePanel';

export function GoalStatePanel(props: Omit<StatePanelProps, 'loadingLabel'>) {
  return <StatePanel {...props} loadingLabel="目標を読み込み中" />;
}
