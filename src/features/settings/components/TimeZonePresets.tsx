import { useState } from 'react';
import { Text } from 'react-native';
import { ActionButton } from '@/shared/components/ActionButton';
import { SelectionRow } from '@/shared/components/timeSelection/SelectionRow';
import { SelectionPanel, type PanelAnchor } from '@/shared/components/timeSelection/SelectionPanel';
import { useTheme } from '@/shared/theme';

const cities = [
  ['東京', 'Asia/Tokyo'],
  ['ソウル', 'Asia/Seoul'],
  ['上海', 'Asia/Shanghai'],
  ['シンガポール', 'Asia/Singapore'],
  ['シドニー', 'Australia/Sydney'],
  ['ロンドン', 'Europe/London'],
  ['パリ', 'Europe/Paris'],
  ['ニューヨーク', 'America/New_York'],
  ['ロサンゼルス', 'America/Los_Angeles'],
  ['UTC', 'UTC'],
] as const;

export function TimeZonePresets({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [anchor, setAnchor] = useState<PanelAnchor | null>(null);
  const { colors, typography } = useTheme();
  const city = cities.find((entry) => entry[1] === value);
  return (
    <>
      <SelectionRow
        label="都市から選ぶ"
        value={city ? `${city[0]}（${value}）` : value}
        disabled={disabled}
        onOpen={setAnchor}
      />
      {anchor ? (
        <SelectionPanel title="タイムゾーンを選ぶ" anchor={anchor} onCancel={() => setAnchor(null)}>
          <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
            現在：{value}。選択後、「変更を保存」で反映します。
          </Text>
          {cities.map(([name, zone]) => (
            <ActionButton
              key={zone}
              label={`${name}（${zone}）`}
              variant={value === zone ? 'primary' : 'secondary'}
              onPress={() => {
                onChange(zone);
                setAnchor(null);
              }}
            />
          ))}
        </SelectionPanel>
      ) : null}
    </>
  );
}
