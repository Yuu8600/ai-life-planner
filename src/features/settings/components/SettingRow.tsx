import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/shared/theme';

import type { SettingItem } from '../data';

type SettingRowProps = {
  isLast: boolean;
  item: SettingItem;
};

export function SettingRow({ isLast, item }: SettingRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${item.label}、${item.value}${item.detail ? `、${item.detail}` : ''}`}
      style={[styles.row, isLast ? styles.lastRow : null]}
    >
      <View style={styles.copy}>
        <Text style={styles.label}>{item.label}</Text>
        {item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
      </View>
      <Text style={styles.value}>{item.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  copy: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 0,
  },
  label: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  detail: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    ...typography.secondary,
  },
  value: {
    flexShrink: 1,
    maxWidth: '100%',
    color: colors.textMuted,
    ...typography.secondary,
  },
});
