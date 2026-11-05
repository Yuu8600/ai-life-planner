import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/shared/theme';

import type { SettingItem } from '../data';

type SettingRowProps = {
  isLast: boolean;
  item: SettingItem;
};

export function SettingRow({ isLast, item }: SettingRowProps) {
  return (
    <View
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
    flex: 1,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  detail: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  value: {
    flexShrink: 1,
    maxWidth: '40%',
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
