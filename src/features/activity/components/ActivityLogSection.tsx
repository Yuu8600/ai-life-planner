import { StyleSheet, Text, View } from 'react-native';

import { formatLocalTimeJa } from '@/features/today';
import { ActionButton } from '@/shared/components/ActionButton';
import { Badge } from '@/shared/components/Badge';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { colors, spacing } from '@/shared/theme';

import type { ActivityLogsState } from '../useActivityLogs';

export function ActivityLogSection({
  state,
  onRetry,
}: {
  state: ActivityLogsState;
  onRetry: () => void;
}) {
  return (
    <View testID="today-activity-log-section">
      <SectionHeader
        title="今日の実行履歴"
        detail={state.status === 'success' ? `${state.logs.length}件` : undefined}
      />
      {state.status === 'loading' ? (
        <Text style={styles.message}>実行履歴を読み込んでいます。</Text>
      ) : state.status === 'error' ? (
        <View>
          <Text accessibilityRole="alert" style={styles.message}>
            実行履歴を読み込めませんでした。予定とTaskは引き続き確認できます。
          </Text>
          <ActionButton label="履歴を再読み込み" onPress={onRetry} variant="secondary" />
        </View>
      ) : state.status === 'success' && state.logs.length > 0 ? (
        state.logs.map((log) => {
          const completed = log.eventType === 'planned_action_completed';
          const time = formatLocalTimeJa(log.occurredAt, log.timezone);
          return (
            <View
              key={log.id}
              testID="activity-log-row"
              style={styles.row}
              accessibilityLabel={`${time}、${log.actionTitle}、${completed ? '完了' : 'スキップ'}`}
            >
              <Text style={styles.time}>{time}</Text>
              <Text style={styles.title}>{log.actionTitle}</Text>
              <Badge
                label={completed ? '完了' : 'スキップ'}
                tone={completed ? 'success' : 'warning'}
              />
            </View>
          );
        })
      ) : (
        <Text style={styles.message}>
          まだ実行履歴はありません。予定を完了・スキップすると、ここに記録されます。
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  time: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  title: { flex: 1, minWidth: 100, color: colors.text, fontSize: 15 },
  message: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginVertical: spacing.md },
});
