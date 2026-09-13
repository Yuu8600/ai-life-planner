import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/shared/theme';

type GoalOptionsNoticeProps = {
  isLoading: boolean;
  message: string | null;
  onRetry: () => void;
};

export function GoalOptionsNotice({ isLoading, message, onRetry }: GoalOptionsNoticeProps) {
  if (!isLoading && !message) return null;

  return (
    <View style={styles.container} testID="task-goal-options-notice">
      <Text accessibilityLiveRegion="polite" style={styles.message}>
        {isLoading ? 'Goal候補を読み込んでいます。' : message}
      </Text>
      {message && !isLoading ? (
        <Pressable
          accessibilityLabel="Goal候補を再読み込み"
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retry, pressed ? styles.pressed : null]}
        >
          <Text style={styles.retryLabel}>再読み込み</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
  },
  message: {
    flex: 1,
    color: colors.warning,
    fontSize: 13,
    lineHeight: 19,
  },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  retryLabel: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.65,
  },
});
