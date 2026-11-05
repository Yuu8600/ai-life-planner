import { StatePanel, type StatePanelProps } from '@/shared/components/StatePanel';

export function SettingsStatePanel(props: Omit<StatePanelProps, 'loadingLabel'>) {
  return <StatePanel {...props} loadingLabel="プロフィール設定を読み込み中" />;
}
