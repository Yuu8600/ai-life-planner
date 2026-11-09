import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';

import {
  SettingsCloseButton,
  useConfirmSettingsExit,
  type SettingsCloseControlProps,
} from '@/features/settings/components/SettingsCloseControl';

export function SettingsExitControl({ dirty, isSaving, onPressBack }: SettingsCloseControlProps) {
  const navigation = useNavigation();
  const confirm = useConfirmSettingsExit(dirty, isSaving);
  usePreventRemove(dirty || isSaving, ({ data }) => {
    // Dispatch the original action so the navigator can resume the exact request.
    confirm(() => navigation.dispatch(data.action));
  });
  return <SettingsCloseButton isSaving={isSaving} onPressBack={onPressBack} />;
}
