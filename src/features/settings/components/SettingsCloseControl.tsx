import { useRef } from 'react';

import { ActionButton } from '@/shared/components/ActionButton';
import { appAlert } from '@/shared/feedback/appAlert';

export type SettingsCloseControlProps = {
  dirty: boolean;
  isSaving: boolean;
  onPressBack: () => void;
};

export const discardTitle = '変更を破棄しますか？';
export const discardMessage = '保存していない設定の変更は失われます。';

export function useConfirmSettingsExit(dirty: boolean, isSaving: boolean) {
  const promptOpen = useRef(false);
  return (leave: () => void) => {
    if (isSaving || promptOpen.current) return;
    if (!dirty) {
      leave();
      return;
    }

    promptOpen.current = true;
    appAlert.alert(discardTitle, discardMessage, [
      {
        text: '編集を続ける',
        style: 'cancel',
        onPress: () => {
          promptOpen.current = false;
        },
      },
      {
        text: '変更を破棄',
        style: 'destructive',
        onPress: () => {
          if (!promptOpen.current) return;
          promptOpen.current = false;
          leave();
        },
      },
    ]);
  };
}

export function SettingsCloseButton({
  isSaving,
  onPressBack,
}: Omit<SettingsCloseControlProps, 'dirty'>) {
  return (
    <ActionButton
      accessibilityLabel="設定を閉じる"
      label="閉じる"
      variant="ghost"
      disabled={isSaving}
      onPress={onPressBack}
    />
  );
}

export function SettingsCloseControl({ dirty, isSaving, onPressBack }: SettingsCloseControlProps) {
  const confirm = useConfirmSettingsExit(dirty, isSaving);
  return <SettingsCloseButton isSaving={isSaving} onPressBack={() => confirm(onPressBack)} />;
}
