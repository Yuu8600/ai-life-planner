import { appAlert } from '@/shared/feedback/appAlert.web';

describe('web confirmation adapter', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'confirm');
  const confirm = jest.fn();
  beforeEach(() => {
    confirm.mockReset();
    Object.defineProperty(window, 'confirm', { configurable: true, value: confirm });
  });
  afterAll(() => {
    if (original) Object.defineProperty(window, 'confirm', original);
    else Reflect.deleteProperty(window, 'confirm');
  });
  it('executes save only after confirmation', () => {
    const save = jest.fn();
    const cancel = jest.fn();
    confirm.mockReturnValueOnce(true);
    appAlert.alert('保存しますか？', '説明', [
      { text: 'キャンセル', style: 'cancel', onPress: cancel },
      { text: '保存', onPress: save },
    ]);
    expect(confirm).toHaveBeenCalledWith('保存しますか？\n\n説明');
    expect(save).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });
  it('does not mutate data after cancellation', () => {
    const remove = jest.fn();
    confirm.mockReturnValueOnce(false);
    appAlert.alert('削除しますか？', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: remove },
    ]);
    expect(remove).not.toHaveBeenCalled();
  });
});
