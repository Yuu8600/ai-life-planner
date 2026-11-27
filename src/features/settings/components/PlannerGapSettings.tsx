import { Text } from 'react-native';
import { Card } from '@/shared/components/Card';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { DurationSelectionRow } from '@/shared/components/timeSelection/DurationSelectionRow';
import { typography, useThemeColors } from '@/shared/theme';

export function PlannerGapSettings({
  value,
  disabled,
  error,
  onChange,
}: {
  value: string;
  disabled: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const colors = useThemeColors();
  return (
    <Card>
      <SectionHeader compact title="作業枠の間隔" />
      <DurationSelectionRow
        label="異なるタスク間の余裕"
        buffer
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
      <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
        0〜240分。新たに配置する作業枠に適用します。
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </Text>
      ) : null}
    </Card>
  );
}
