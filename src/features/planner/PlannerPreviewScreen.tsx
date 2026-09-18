import { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

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
import type { PlannerPersistenceRepository } from './repositories/PlannerPersistenceRepository';
import { usePlannerPreview } from './usePlannerPreview';

type PlannerPreviewScreenProps = {
  calendarRepository: CalendarRepository | null;
  goalRepository: PlannerPreviewGoalRepository | null;
  now?: () => Date;
  onOpenSettings?: () => void;
  persistenceRepository: PlannerPersistenceRepository | null;
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
  persistenceRepository,
  provider,
  refreshToken = 0,
  settingsRepository,
  taskRepository,
}: PlannerPreviewScreenProps) {
  const { approve, calendar, canApprove, canGenerate, discard, generate, saveState, state } =
    usePlannerPreview({
      calendarRepository,
      goalRepository,
      now,
      persistenceRepository,
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
  const confirmApproval = () => {
    Alert.alert(
      'この計画を採用しますか？',
      '今日の既存の計画がある場合は、このプレビューの内容で置き換えます。',
      [
        { style: 'cancel', text: 'キャンセル' },
        { onPress: approve, text: '採用する' },
      ],
    );
  };

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
          <PlannerPreview isSaved={saveState.status === 'success'} preview={preview} />
          {saveState.status === 'success' ? (
            <View style={styles.saveSuccess} testID="planner-save-success">
              <Text style={styles.saveSuccessTitle}>今日の計画を保存しました</Text>
              <Text style={styles.saveSuccessText}>
                {saveState.plan.actionCount}件のActionを保存しました。
              </Text>
            </View>
          ) : saveState.status === 'error' ? (
            <View style={styles.saveError} testID="planner-save-error">
              <Text style={styles.saveErrorTitle}>計画を保存できませんでした</Text>
              <Text style={styles.saveErrorText}>{saveState.message}</Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            {saveState.status !== 'success' ? (
              <ActionButton
                accessibilityLabel={
                  saveState.status === 'error' ? '計画の保存を再試行する' : 'この計画を採用する'
                }
                disabled={!canApprove}
                label={
                  saveState.status === 'saving'
                    ? '保存中…'
                    : saveState.status === 'error'
                      ? '保存を再試行'
                      : 'この計画を採用'
                }
                onPress={confirmApproval}
              />
            ) : null}
            <ActionButton
              accessibilityLabel="最新データで今日の計画を再生成する"
              disabled={!canGenerate}
              label="再生成"
              onPress={() => void generate()}
              variant="secondary"
            />
            <ActionButton
              disabled={saveState.status === 'saving'}
              label="プレビューを閉じる"
              onPress={discard}
              variant="ghost"
            />
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
  saveSuccess: {
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  saveSuccessTitle: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  saveSuccessText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  saveError: {
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  saveErrorTitle: {
    color: colors.warning,
    fontSize: 15,
    fontWeight: '700',
  },
  saveErrorText: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 19,
  },
});
