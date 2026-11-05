import { StatePanel, type StatePanelProps } from '@/shared/components/StatePanel';

export function PlannerStatePanel(props: Omit<StatePanelProps, 'loadingLabel'>) {
  return <StatePanel {...props} loadingLabel="Plannerを実行中" />;
}
