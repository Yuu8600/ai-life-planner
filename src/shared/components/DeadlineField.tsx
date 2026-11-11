import { useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { formatDateInput } from '@/shared/dateInput';
import { ActionButton } from './ActionButton';
import { DeadlineCalendar } from './DeadlineCalendar';
import { FormField } from './FormField';
import { SelectionPanel, type PanelAnchor } from './timeSelection/SelectionPanel';
import { SelectionRow } from './timeSelection/SelectionRow';

export function DeadlineField({
  accessibilityLabel,
  disabled,
  error,
  onChange,
  value,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  error?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [anchor, setAnchor] = useState<PanelAnchor | null>(null);
  const [draft, setDraft] = useState('');
  const close = () => setAnchor(null);
  const commit = (date: string) => {
    if (disabled) return;
    onChange(date);
    close();
  };
  const [year, month, day] = value.split('-').map(Number);

  return (
    <FormField error={error} label="期限">
      <SelectionRow
        label="日付を選ぶ"
        value={value ? `${year}年${month}月${day}日` : '期限なし'}
        disabled={disabled}
        onOpen={(position) => {
          if (Platform.OS !== 'web') Keyboard.dismiss();
          setDraft(value || formatDateInput(new Date()));
          setAnchor(position);
        }}
      />
      {anchor && !disabled ? (
        Platform.OS === 'android' ? (
          <DeadlineCalendar
            label={accessibilityLabel}
            value={draft}
            onChange={commit}
            onClear={() => commit('')}
            onDismiss={close}
          />
        ) : (
          <SelectionPanel title={accessibilityLabel} anchor={anchor} onCancel={close}>
            <DeadlineCalendar label="期限の日付" value={draft} onChange={setDraft} />
            <ActionButton label="日付を決定" disabled={!draft} onPress={() => commit(draft)} />
            <ActionButton label="期限なし" onPress={() => commit('')} variant="secondary" />
            <ActionButton label="キャンセル" onPress={close} variant="ghost" />
          </SelectionPanel>
        )
      ) : null}
    </FormField>
  );
}
