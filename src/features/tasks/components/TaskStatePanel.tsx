import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { colors, radius, spacing } from '@/shared/theme';

type TaskStatePanelProps = {
  actionLabel?: string;
  isLoading?: boolean;
  message: string;
  onPressAction?: () => void;
  testID: string;
  title: string;
};

export function TaskStatePanel({
  actionLabel,
  isLoading = false,
  message,
  onPressAction,
  testID,
  title,
}: TaskStatePanelProps) {
  return (
    <View style={styles.container} testID={testID}>
      {isLoading ? (
        <ActivityIndicator accessibilityLabel="タスクを読み込み中" color={colors.accent} />
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onPressAction ? (
        <ActionButton label={actionLabel} onPress={onPressAction} variant="secondary" />
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
