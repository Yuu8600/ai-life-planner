import { useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { formatCalendarDateJa, formatDateInput } from '@/shared/dateInput';
import { ActionButton } from './ActionButton';
import { DeadlineCalendar } from './DeadlineCalendar';
import { FormField } from './FormField';
import { SelectionPanel, type PanelAnchor } from './timeSelection/SelectionPanel';
import { SelectionRow } from './timeSelection/SelectionRow';

export function DeadlineField({
  accessibilityLabel,
  label = '期限',
  allowClear = true,
  emptyLabel = '期限なし',
  clearLabel = '期限なし',
  disabled,
  error,
  onChange,
  value,
}: {
  label?: string;
  allowClear?: boolean;
  emptyLabel?: string;
  clearLabel?: string;
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
    if (disabled || (!allowClear && !date)) return;
    onChange(date);
    close();
  };

  return (
    <FormField error={error} label={label}>
      <SelectionRow
        label="日付を選ぶ"
        value={value ? formatCalendarDateJa(value) : emptyLabel}
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
            onClear={allowClear ? () => commit('') : undefined}
            clearLabel={clearLabel}
            onDismiss={close}
          />
        ) : (
          <SelectionPanel title={accessibilityLabel} anchor={anchor} onCancel={close}>
            <DeadlineCalendar label={accessibilityLabel} value={draft} onChange={setDraft} />
            <ActionButton label="日付を決定" disabled={!draft} onPress={() => commit(draft)} />
            {allowClear ? (
              <ActionButton label={clearLabel} onPress={() => commit('')} variant="secondary" />
            ) : null}
          </SelectionPanel>
        )
      ) : null}
    </FormField>
  );
}
