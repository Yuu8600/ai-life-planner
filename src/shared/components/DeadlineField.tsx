import { useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';

import { addLocalDays, getLocalDate } from '@/features/today';
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
  timezone,
}: {
  label?: string;
  timezone?: string;
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

  const today = timezone ? getLocalDate(new Date(), timezone) : formatDateInput(new Date());
  const presets = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {[
        { label: '今日', days: 0 },
        { label: '明日', days: 1 },
        { label: '来週（7日後）', days: 7 },
      ].map((item) => (
        <ActionButton
          key={item.days}
          label={item.label}
          accessibilityLabel={`${accessibilityLabel}を${item.label}にする`}
          variant="secondary"
          disabled={disabled}
          onPress={() => commit(addLocalDays(today, item.days))}
        />
      ))}
    </View>
  );

  return (
    <FormField error={error} label={label}>
      <SelectionRow
        label="日付を選ぶ"
        value={value ? formatCalendarDateJa(value) : emptyLabel}
        disabled={disabled}
        onOpen={(position) => {
          if (Platform.OS !== 'web') Keyboard.dismiss();
          setDraft(value || today);
          setAnchor(position);
        }}
      />
      {Platform.OS === 'android' ? presets : null}
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
            {presets}
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
