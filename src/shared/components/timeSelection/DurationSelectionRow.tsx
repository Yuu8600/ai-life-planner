import { useCallback, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { colors, spacing } from '@/shared/theme';
import { ActionButton } from '../ActionButton';
import { SelectionPanel, type PanelAnchor } from './SelectionPanel';
import { SelectionRow } from './SelectionRow';
export function DurationSelectionRow({
  label,
  value,
  onChange,
  disabled,
  buffer = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  buffer?: boolean;
}) {
  const presets = buffer ? [0, 10, 15, 30, 60] : [10, 15, 20, 30, 60];
  const [anchor, setAnchor] = useState<PanelAnchor | null>(null),
    [draft, setDraft] = useState(value),
    [custom, setCustom] = useState(false),
    [error, setError] = useState<string | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  const confirm = () => {
    const n = Number(draft);
    if (
      !/^\d+$/.test(draft) ||
      !Number.isSafeInteger(n) ||
      n < (buffer ? 0 : 1) ||
      n > (buffer ? 240 : 2147483647)
    ) {
      setError(buffer ? '0〜240分の整数で入力してください。' : '1以上の整数で入力してください。');
      return;
    }
    onChange(String(n));
    close();
  };
  return (
    <>
      <SelectionRow
        label={label}
        value={`${value}分`}
        disabled={disabled}
        onOpen={(position) => {
          setDraft(value);
          setCustom(!presets.includes(Number(value)));
          setError(null);
          setAnchor(position);
        }}
      />
      {anchor ? (
        <SelectionPanel title={label} anchor={anchor} onCancel={close}>
          <Text accessibilityRole="header">{label}</Text>
          <Text>選択中: {draft}分</Text>
          <View style={{ gap: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
            {presets.map((n) => (
              <ActionButton
                key={n}
                label={`${!custom && draft === String(n) ? '✓ ' : ''}${n}分`}
                variant={!custom && draft === String(n) ? 'primary' : 'secondary'}
                onPress={() => {
                  setDraft(String(n));
                  setCustom(false);
                  setError(null);
                }}
              />
            ))}
          </View>
          <ActionButton
            label={custom ? '✓ その他' : 'その他'}
            variant={custom ? 'primary' : 'secondary'}
            onPress={() => setCustom(true)}
          />
          {custom ? (
            <TextInput
              accessibilityLabel={`${label}の詳細（分）`}
              keyboardType="number-pad"
              value={draft}
              onChangeText={setDraft}
              style={{
                minHeight: 48,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                color: colors.text,
                fontSize: 16,
              }}
            />
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.warning }}>
              {error}
            </Text>
          ) : null}
          <ActionButton label="決定" onPress={confirm} />
          <ActionButton label="キャンセル" variant="ghost" onPress={close} />
        </SelectionPanel>
      ) : null}
    </>
  );
}
