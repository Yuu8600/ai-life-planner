import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { colors, radius, spacing } from '@/shared/theme';

export function ChangeProposal() {
  return (
    <View accessibilityLabel="AIからの予定変更案" style={styles.container}>
      <Text style={styles.eyebrow}>変更案</Text>
      <View style={styles.scheduleRow}>
        <View>
          <Text style={styles.oldTime}>18:00–18:30</Text>
          <Text style={styles.task}>Part 5</Text>
        </View>
        <Text accessibilityElementsHidden style={styles.arrow}>
          →
        </Text>
        <View>
          <Text style={styles.newTime}>17:00–17:30</Text>
          <Text style={styles.task}>Part 5</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <ActionButton label="キャンセル" style={styles.action} variant="ghost" />
        <ActionButton label="変更する" style={styles.action} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  oldTime: {
    color: colors.textMuted,
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  newTime: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  task: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: 13,
  },
  arrow: {
    color: colors.textSubtle,
    fontSize: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  action: {
    minWidth: 104,
  },
});
