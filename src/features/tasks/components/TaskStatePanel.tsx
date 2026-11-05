import { StatePanel, type StatePanelProps } from '@/shared/components/StatePanel';

export function TaskStatePanel(props: Omit<StatePanelProps, 'loadingLabel'>) {
  return <StatePanel {...props} loadingLabel="タスクを読み込み中" />;
}
