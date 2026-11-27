import { appAlert } from './appAlert';

export function confirmDiscardChanges(dirty: boolean, proceed: () => void) {
  if (!dirty) {
    proceed();
    return;
  }
  appAlert.alert('変更を破棄しますか？', '保存していない入力内容は失われます。', [
    { text: '編集を続ける', style: 'cancel' },
    { text: '変更を破棄', style: 'destructive', onPress: proceed },
  ]);
}
