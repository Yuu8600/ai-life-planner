import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { ActionButton } from '../ActionButton';
import { SelectionPanel, type PanelAnchor } from './SelectionPanel';
import { SelectionRow } from './SelectionRow';
import { OptionColumn } from './OptionColumn';
export function TimeSelectionRow({
  label,
  value,
  dayOffset,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  dayOffset?: string;
  disabled?: boolean;
  onChange: (time: string, offset?: string) => void;
}) {
  const [anchor, setAnchor] = useState<PanelAnchor | null>(null),
    [hour, setHour] = useState('00'),
    [minute, setMinute] = useState('00'),
    [offset, setOffset] = useState('0'),
    [fine, setFine] = useState(false);
  const close = useCallback(() => setAnchor(null), []);
  const quarters = ['00', '15', '30', '45'];
  const minutes = fine
    ? Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
    : [...new Set([...quarters, minute])].sort();
  return (
    <>
      <SelectionRow
        label={label}
        value={`${dayOffset === '1' ? '翌日 ' : ''}${value}`}
        disabled={disabled}
        onOpen={(position) => {
          const [h, m] = value.split(':');
          setHour(h);
          setMinute(m);
          setOffset(dayOffset ?? '0');
          setFine(false);
          setAnchor(position);
        }}
      />
      {anchor ? (
        <SelectionPanel title={label} anchor={anchor} onCancel={close}>
          <Text accessibilityRole="header">{label}</Text>
          <Text>
            {offset === '1' && dayOffset !== undefined ? '翌日 ' : ''}
            {hour}:{minute}
          </Text>
          {dayOffset !== undefined ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ActionButton
                label={`${offset === '0' ? '✓ ' : ''}当日`}
                variant={offset === '0' ? 'primary' : 'secondary'}
                onPress={() => setOffset('0')}
              />
              <ActionButton
                label={`${offset === '1' ? '✓ ' : ''}翌日`}
                variant={offset === '1' ? 'primary' : 'secondary'}
                onPress={() => setOffset('1')}
              />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <OptionColumn
              label="時"
              options={Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))}
              value={hour}
              onChange={setHour}
            />
            <OptionColumn label="分" options={minutes} value={minute} onChange={setMinute} />
          </View>
          {!quarters.includes(minute) ? (
            <Text>現在の分「{minute}」を正確に保持しています。</Text>
          ) : null}
          <ActionButton
            label={fine ? '15分刻みの候補に戻す' : '1分単位で選ぶ'}
            variant="ghost"
            onPress={() => setFine(!fine)}
          />
          <ActionButton
            label="決定"
            onPress={() => {
              onChange(`${hour}:${minute}`, dayOffset === undefined ? undefined : offset);
              close();
            }}
          />
          <ActionButton label="キャンセル" variant="ghost" onPress={close} />
        </SelectionPanel>
      ) : null}
    </>
  );
}
