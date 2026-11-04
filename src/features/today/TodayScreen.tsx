import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import {
  ActivityLogSection,
  useActivityLogs,
  type ActivityLogRepository,
} from '@/features/activity';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { colors, radius, spacing } from '@/shared/theme';

import { formatTodayDateLabel, toDeadlineTaskItems, toTimelineItems } from './presentation';
import type { TodayRepository } from './repositories/TodayRepository';
import type { PlannedActionExecutionRepository } from './repositories/PlannedActionExecutionRepository';
import { useToday } from './useToday';
import { usePlannedActionExecution } from './usePlannedActionExecution';
import { PlanSummary } from './components/PlanSummary';
import { Timeline } from './components/Timeline';
import { TodayStatePanel } from './components/TodayStatePanel';
import { DeadlineTaskList } from './components/DeadlineTaskList';

type TodayScreenProps = {
  onPressReplan?: () => void;
  onPressAi: () => void;
  onPressSettings: () => void;
  refreshToken?: number;
  repository: TodayRepository | null;
  executionRepository?: PlannedActionExecutionRepository | null;
  activityLogRepository?: ActivityLogRepository | null;
};

export function TodayScreen({
  onPressReplan,
  onPressAi,
  onPressSettings,
  refreshToken = 0,
  repository,
  executionRepository = null,
  activityLogRepository = null,
}: TodayScreenProps) {
  const { dataRevision, isLoading, loadError, refresh, retry, today } = useToday(
    repository,
    refreshToken,
  );
  const activity = useActivityLogs(activityLogRepository, today?.localDate ?? null, dataRevision);
  const { execute, mutations } = usePlannedActionExecution(executionRepository, refresh);
  const timelineItems = today?.plan ? toTimelineItems(today.plan) : [];
  const deadlineTaskItems = today ? toDeadlineTaskItems(today.deadlineTasks) : [];
  const completedActions = today?.plan?.actions.filter(
    (action) => action.status === 'completed',
  ).length;

  return (
    <AppScreen testID="today-screen">
      <ScreenHeader
        action={
          <Pressable
            accessibilityLabel="設定を開く"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onPressSettings}
            style={({ pressed }) => [styles.settingsButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        }
        eyebrow={today ? formatTodayDateLabel(today.localDate) : undefined}
        subtitle="今日も、使える時間から始めましょう。"
        title={today?.greeting ?? '今日の予定'}
      />

      {isLoading && !today ? (
        <TodayStatePanel
          isLoading
          message="Supabaseから今日の予定を取得しています。"
          testID="today-loading-state"
          title="読み込み中"
        />
      ) : loadError && !today ? (
        <TodayStatePanel
          actionLabel={repository ? '再読み込み' : undefined}
          message={loadError}
          onPressAction={repository ? retry : undefined}
          testID="today-error-state"
          title={repository ? '今日の予定を読み込めませんでした' : 'ログインが必要です'}
        />
      ) : today ? (
        <>
          {loadError ? (
            <TodayStatePanel
              actionLabel="再読み込み"
              message={loadError}
              onPressAction={retry}
              testID="today-refresh-error"
              title="最新の予定を読み込めませんでした"
            />
          ) : null}
          {today.plan ? (
            <>
              <PlanSummary
                completedActions={completedActions ?? 0}
                summary={today.plan.summary ?? '今日の実行予定を確認しましょう。'}
                totalActions={today.plan.actions.length}
              />
              <SectionHeader detail={`${today.plan.actions.length}件`} title="今日の計画" />
              {onPressReplan ? (
                <ActionButton
                  label="再計画する"
                  onPress={onPressReplan}
                  disabled={
                    isLoading ||
                    Boolean(loadError) ||
                    Object.values(mutations).some((mutation) => mutation.status === 'updating')
                  }
                  variant="secondary"
                />
              ) : null}
              {today.plan.actions.length > 0 ? (
                <Timeline
                  items={timelineItems}
                  mutations={mutations}
                  executionDisabled={isLoading || Boolean(loadError)}
                  onExecute={
                    executionRepository
                      ? (id, targetStatus) => {
                          const action = today.plan?.actions.find((item) => item.id === id);
                          if (!action || action.status !== 'scheduled') return;
                          if (targetStatus === 'completed') {
                            void execute(action, targetStatus);
                          } else {
                            Alert.alert(
                              'この予定をスキップしますか？',
                              '関連するTaskは未完了のまま残ります。',
                              [
                                { text: 'キャンセル', style: 'cancel' },
                                {
                                  text: 'スキップ',
                                  onPress: () => void execute(action, targetStatus),
                                },
                              ],
                            );
                          }
                        }
                      : undefined
                  }
                />
              ) : (
                <TodayStatePanel
                  message="計画は保存されていますが、予定されたActionはありません。"
                  testID="today-plan-actions-empty"
                  title="予定されたアクションはありません"
                />
              )}
            </>
          ) : (
            <>
              <SectionHeader detail="保存済みPlan" title="今日の計画" />
              <TodayStatePanel
                message="AIタブで今日の計画を作成できます。"
                testID="today-plan-empty-state"
                title="今日の計画はまだありません"
              />
            </>
          )}

          <SectionHeader detail={`${deadlineTaskItems.length}件`} title="今日が期限のTask" />
          <DeadlineTaskList items={deadlineTaskItems} />
          <ActivityLogSection state={activity.state} onRetry={activity.retry} />
        </>
      ) : null}

      <ActionButton
        accessibilityLabel="AIに今日の計画を相談する"
        label="AIに相談する"
        onPress={onPressAi}
        style={styles.aiButton}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  settingsIcon: {
    color: colors.text,
    fontSize: 20,
  },
  pressed: {
    opacity: 0.7,
  },
  aiButton: {
    marginTop: spacing.xl,
  },
});
