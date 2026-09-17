import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { colors, radius, spacing } from '@/shared/theme';

type PlannerStatePanelProps = {
  actionLabel?: string;
  disabled?: boolean;
  isLoading?: boolean;
  message: string;
  onPressAction?: () => void;
  testID: string;
  title: string;
};

export function PlannerStatePanel({
  actionLabel,
  disabled = false,
  isLoading = false,
  message,
  onPressAction,
  testID,
  title,
}: PlannerStatePanelProps) {
  return (
    <View style={styles.container} testID={testID}>
      {isLoading ? (
        <ActivityIndicator accessibilityLabel="Plannerを実行中" color={colors.accent} />
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onPressAction ? (
        <ActionButton
          disabled={disabled}
          label={actionLabel}
          onPress={onPressAction}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
