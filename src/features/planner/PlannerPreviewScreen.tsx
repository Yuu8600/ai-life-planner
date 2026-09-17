import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CalendarRepository } from '@/features/calendar';
import type { SettingsRepository } from '@/features/settings';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { colors, radius, spacing } from '@/shared/theme';

import { PlannerPreview } from './components/PlannerPreview';
import { PlannerStatePanel } from './components/PlannerStatePanel';
import type { PlannerPreviewGoalRepository, PlannerPreviewTaskRepository } from './plannerPreview';
import { formatPlannerDateLabel, toPlannerPreviewViewModel } from './plannerPreviewPresentation';
import type { PlannerProvider } from './providers/PlannerProvider';
import { usePlannerPreview } from './usePlannerPreview';

type PlannerPreviewScreenProps = {
  calendarRepository: CalendarRepository | null;
  goalRepository: PlannerPreviewGoalRepository | null;
  now?: () => Date;
  onOpenSettings?: () => void;
  provider: PlannerProvider;
  refreshToken?: number;
  settingsRepository: SettingsRepository | null;
  taskRepository: PlannerPreviewTaskRepository | null;
};

export function PlannerPreviewScreen({
  calendarRepository,
  goalRepository,
  now,
  onOpenSettings,
  provider,
  refreshToken = 0,
  settingsRepository,
  taskRepository,
}: PlannerPreviewScreenProps) {
  const { calendar, canGenerate, discard, generate, state } = usePlannerPreview({
    calendarRepository,
    goalRepository,
    now,
    provider,
    refreshToken,
    settingsRepository,
    taskRepository,
  });
  const dateLabel = useMemo(
    () =>
      calendar.selectedDate && calendar.timeZone
        ? formatPlannerDateLabel(calendar.selectedDate, calendar.timeZone)
        : undefined,
    [calendar.selectedDate, calendar.timeZone],
  );
  const preview = useMemo(
    () => (state.status === 'success' ? toPlannerPreviewViewModel(state) : null),
    [state],
  );

  return (
    <AppScreen testID="planner-preview-screen">
      <ScreenHeader
        eyebrow={dateLabel}
        subtitle="Goals・Tasks・端末カレンダーから、今日の実行案を作成します。"
        title="Planner Preview"
      />

      {calendar.accessState === 'checking' ? (
        <PlannerStatePanel
          isLoading
          message="プロフィール設定とカレンダー権限を確認しています。"
          testID="planner-checking-state"
          title="確認中"
        />
      ) : calendar.accessState === 'undetermined' ? (
        <PlannerStatePanel
          actionLabel={calendar.isRequestingPermission ? '確認中…' : 'アクセスを許可する'}
          disabled={calendar.isRequestingPermission}
          message="固定予定との重なりを避けるため、端末カレンダーの読み取り権限が必要です。予定の変更は行いません。"
          onPressAction={() => void calendar.requestPermission()}
          testID="planner-permission-prompt"
          title="カレンダーへのアクセス"
        />
      ) : calendar.accessState === 'denied' ? (
        <PlannerStatePanel
          actionLabel={calendar.canAskAgain ? 'もう一度許可する' : 'OS設定を開く'}
          disabled={calendar.isRequestingPermission}
          message={
            calendar.canAskAgain
              ? '計画を作成するにはカレンダーへのアクセスを許可してください。'
              : 'カレンダーへのアクセスが拒否されています。OS設定から権限を許可してください。'
          }
          onPressAction={
            calendar.canAskAgain ? () => void calendar.requestPermission() : onOpenSettings
          }
          testID="planner-permission-denied"
          title="計画を作成できません"
        />
      ) : calendar.accessState === 'unavailable' ? (
        <PlannerStatePanel
          message={
            calendar.loadError ??
            'このビルドでは端末カレンダーを利用できません。development buildで開いてください。'
          }
          testID="planner-calendar-unavailable"
          title="端末カレンダーを利用できません"
        />
      ) : calendar.accessState === 'error' ? (
        <PlannerStatePanel
          actionLabel={calendarRepository && settingsRepository ? '再読み込み' : undefined}
          message={calendar.loadError ?? 'Plannerを利用するにはログインが必要です。'}
          onPressAction={calendarRepository && settingsRepository ? calendar.retry : undefined}
          testID="planner-calendar-error"
          title={calendarRepository && settingsRepository ? '読み込みエラー' : 'ログインが必要です'}
        />
      ) : calendar.isLoadingEvents || (calendar.calendarCount === null && !calendar.loadError) ? (
        <PlannerStatePanel
          isLoading
          message="今日の端末カレンダー予定を読み込んでいます。"
          testID="planner-calendar-loading"
          title="予定を確認中"
        />
      ) : calendar.loadError ? (
        <PlannerStatePanel
          actionLabel="再読み込み"
          message={calendar.loadError}
          onPressAction={calendar.retry}
          testID="planner-calendar-error"
          title="予定を読み込めませんでした"
        />
      ) : state.status === 'loading' ? (
        <PlannerStatePanel
          isLoading
          message="最新のSettings・Calendar・Goals・Tasksから計画を作成しています。"
          testID="planner-generating-state"
          title="計画を作成中"
        />
      ) : state.status === 'error' ? (
        <>
          <PlannerStatePanel
            actionLabel="もう一度作成"
            message={state.message}
            onPressAction={() => void generate()}
            testID={`planner-${state.kind}-error`}
            title="計画を生成できませんでした"
          />
          {state.issues.length > 0 ? (
            <View style={styles.issueCard} testID="planner-validation-issues">
              <Text style={styles.issueTitle}>検証結果</Text>
              {state.issues.map((issue, index) => (
                <Text key={`${issue.code}-${issue.path}-${index}`} style={styles.issueText}>
                  {issue.code}: {issue.message}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : state.status === 'success' && preview ? (
        <>
          <PlannerPreview preview={preview} />
          <View style={styles.actions}>
            <ActionButton
              accessibilityLabel="最新データで今日の計画を再生成する"
              disabled={!canGenerate}
              label="再生成"
              onPress={() => void generate()}
            />
            <ActionButton label="プレビューを閉じる" onPress={discard} variant="ghost" />
          </View>
        </>
      ) : (
        <View style={styles.introCard} testID="planner-idle-state">
          <Text style={styles.introTitle}>今日使える時間から計画を作ります</Text>
          <Text style={styles.introText}>
            現在のGoals・Tasks・Settingsと、端末カレンダーの固定予定を確認して、保存前のプレビューを表示します。
          </Text>
          <ActionButton
            accessibilityLabel="今日の計画を作成する"
            disabled={!canGenerate}
            label="今日の計画を作成"
            onPress={() => void generate()}
            style={styles.createButton}
          />
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  introCard: {
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  introTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  introText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  createButton: {
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  issueCard: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  issueTitle: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '700',
  },
  issueText: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
  },
});
