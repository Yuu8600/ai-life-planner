import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CalendarRepository } from '@/features/calendar';
import type { SettingsRepository } from '@/features/settings';
import { Badge } from '@/shared/components/Badge';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { colors, radius, spacing } from '@/shared/theme';

import { PlannerPreview } from './components/PlannerPreview';
import { PlannerStatePanel } from './components/PlannerStatePanel';
import type { PlannerPreviewGoalRepository, PlannerPreviewTaskRepository } from './plannerPreview';
import { formatPlannerDateLabel, toPlannerPreviewViewModel } from './plannerPreviewPresentation';
import type { PlannerProvider } from './providers/PlannerProvider';
import type { PlannerProviderId } from './plannerProviderSelection';
import type { PlannerPersistenceRepository } from './repositories/PlannerPersistenceRepository';
import { usePlannerPreview } from './usePlannerPreview';
import type { PlannerReplanRepository } from './repositories/PlannerReplanRepository';

type PlannerPreviewScreenProps = {
  mode?: 'generate' | 'replan';
  replanRepository?: PlannerReplanRepository | null;
  onReplanSaved?: () => void;
  onCancelReplan?: () => void;
  onPressToday?: () => void;
  calendarRepository: CalendarRepository | null;
  goalRepository: PlannerPreviewGoalRepository | null;
  now?: () => Date;
  onOpenSettings?: () => void;
  onSelectProvider?: (id: PlannerProviderId) => void;
  openAiAvailability?: 'available' | 'checking' | 'unavailable';
  persistenceRepository: PlannerPersistenceRepository | null;
  provider: PlannerProvider;
  refreshToken?: number;
  settingsRepository: SettingsRepository | null;
  taskRepository: PlannerPreviewTaskRepository | null;
};

export function PlannerPreviewScreen({
  mode = 'generate',
  replanRepository = null,
  onReplanSaved,
  onCancelReplan,
  onPressToday,
  calendarRepository,
  goalRepository,
  now,
  onOpenSettings,
  onSelectProvider,
  openAiAvailability = 'unavailable',
  persistenceRepository,
  provider,
  refreshToken = 0,
  settingsRepository,
  taskRepository,
}: PlannerPreviewScreenProps) {
  const { approve, calendar, canApprove, canGenerate, discard, generate, saveState, state } =
    usePlannerPreview({
      mode,
      replanRepository,
      onSaved: mode === 'replan' ? onReplanSaved : undefined,
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
      state.status === 'success'
        ? formatPlannerDateLabel(state.input.date, state.timezone)
        : calendar.selectedDate && calendar.timeZone
          ? formatPlannerDateLabel(calendar.selectedDate, calendar.timeZone)
          : undefined,
    [calendar.selectedDate, calendar.timeZone, state],
  );
  const showCalendarStatus = state.status !== 'success';
  const preview = useMemo(
    () =>
      state.status === 'success' && state.providerId === provider.id
        ? toPlannerPreviewViewModel(state)
        : null,
    [provider.id, state],
  );
  const confirmApproval = () => {
    Alert.alert(
      'この計画を保存しますか？',
      mode === 'replan'
        ? `今日の計画をこの内容に置き換えます。途中の予定も組み直されます。完了・スキップの履歴は残ります。${state.status === 'success' && state.proposal.actions.length === 0 ? '\n新しい予定は0件です。旧計画の予定もすべて削除されます。' : ''}`
        : '今日の既存の計画がある場合は、このプレビューの内容で置き換えます。',
      [
        { style: 'cancel', text: 'キャンセル' },
        { onPress: approve, text: '保存する' },
      ],
    );
  };

  return (
    <AppScreen testID="planner-preview-screen">
      <ScreenHeader
        eyebrow={dateLabel}
        subtitle={
          mode === 'replan'
            ? '現在時刻以降の予定を、最新のTaskとカレンダーから組み直します。'
            : '目標につながるタスクを、カレンダーの空き時間へ配置します。'
        }
        title={mode === 'replan' ? '今日の計画を再計画' : '今日の計画を作成'}
      />

      <View accessibilityLabel="計画作成の流れ" style={styles.flow}>
        <Badge label="1 作成" tone={state.status !== 'success' ? 'accent' : 'neutral'} />
        <Badge
          label="2 プレビュー"
          tone={state.status === 'success' && saveState.status !== 'success' ? 'accent' : 'neutral'}
        />
        <Badge label="3 保存" tone={saveState.status === 'success' ? 'accent' : 'neutral'} />
      </View>

      {onSelectProvider ? (
        <View
          accessibilityRole="radiogroup"
          style={styles.providerOptions}
          testID="planner-provider-options"
        >
          <Text style={styles.providerHeading}>生成方法</Text>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{
              selected: provider.id === 'rule-based',
              disabled: saveState.status === 'saving',
            }}
            disabled={saveState.status === 'saving'}
            onPress={() => onSelectProvider('rule-based')}
            style={[
              styles.providerOption,
              provider.id === 'rule-based' && styles.selectedProviderOption,
            ]}
            testID="planner-provider-rule-based"
          >
            <Text style={styles.providerTitle}>
              {provider.id === 'rule-based' ? '◉' : '○'} ルールベース
            </Text>
            <Text style={styles.providerDescription}>API設定なし・標準</Text>
          </Pressable>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{
              selected: provider.id === 'openai',
              disabled: openAiAvailability !== 'available' || saveState.status === 'saving',
            }}
            disabled={openAiAvailability !== 'available' || saveState.status === 'saving'}
            onPress={() => onSelectProvider('openai')}
            style={[
              styles.providerOption,
              provider.id === 'openai' && styles.selectedProviderOption,
              openAiAvailability !== 'available' && styles.unavailableProvider,
            ]}
            testID="planner-provider-openai"
          >
            <Text style={styles.providerTitle}>{provider.id === 'openai' ? '◉' : '○'} OpenAI</Text>
            <Text style={styles.providerDescription}>
              {openAiAvailability === 'available'
                ? '任意・AIを使って計画'
                : openAiAvailability === 'checking'
                  ? '利用状況を確認中…'
                  : '任意・現在利用できません'}
            </Text>
          </Pressable>
          <Text style={styles.providerDescription}>
            OpenAIを設定しなくても、ルールベースで計画を作成・保存できます。
          </Text>
        </View>
      ) : null}

      {showCalendarStatus && calendar.accessState === 'checking' ? (
        <PlannerStatePanel
          isLoading
          message="プロフィール設定とカレンダー権限を確認しています。"
          testID="planner-checking-state"
          title="確認中"
        />
      ) : showCalendarStatus && calendar.accessState === 'undetermined' ? (
        <PlannerStatePanel
          actionLabel={calendar.isRequestingPermission ? '確認中…' : 'アクセスを許可する'}
          disabled={calendar.isRequestingPermission}
          message="固定予定との重なりを避けるため、端末カレンダーの読み取り権限が必要です。予定の変更は行いません。"
          onPressAction={() => void calendar.requestPermission()}
          testID="planner-permission-prompt"
          title="カレンダーへのアクセス"
        />
      ) : showCalendarStatus && calendar.accessState === 'denied' ? (
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
      ) : showCalendarStatus && calendar.accessState === 'unavailable' ? (
        <PlannerStatePanel
          message={
            calendar.loadError ??
            'このビルドでは端末カレンダーを利用できません。development buildで開いてください。'
          }
          testID="planner-calendar-unavailable"
          title="端末カレンダーを利用できません"
        />
      ) : showCalendarStatus && calendar.accessState === 'error' ? (
        <PlannerStatePanel
          actionLabel={calendarRepository && settingsRepository ? '再読み込み' : undefined}
          message={calendar.loadError ?? 'Plannerを利用するにはログインが必要です。'}
          onPressAction={calendarRepository && settingsRepository ? calendar.retry : undefined}
          testID="planner-calendar-error"
          title={calendarRepository && settingsRepository ? '読み込みエラー' : 'ログインが必要です'}
        />
      ) : showCalendarStatus &&
        (calendar.isLoadingEvents || (calendar.calendarCount === null && !calendar.loadError)) ? (
        <PlannerStatePanel
          isLoading
          message="今日の端末カレンダー予定を読み込んでいます。"
          testID="planner-calendar-loading"
          title="予定を確認中"
        />
      ) : showCalendarStatus && calendar.loadError ? (
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
          message="最新の設定・タスク・端末の予定から、今日の計画を作成しています。"
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
          <Text style={styles.providerLabel} testID="planner-preview-provider-label">
            生成方法: {state.providerId === 'openai' ? 'OpenAI' : 'ルールベース（API不要）'}
          </Text>
          <PlannerPreview isSaved={saveState.status === 'success'} preview={preview} />
          {saveState.status === 'success' ? (
            <View style={styles.saveSuccess} testID="planner-save-success">
              <Text style={styles.saveSuccessTitle}>今日の計画を保存しました</Text>
              <Text style={styles.saveSuccessText}>
                {saveState.plan.actionCount}件の予定を保存しました。Todayで確認できます。
              </Text>
              {mode === 'generate' && onPressToday ? (
                <ActionButton label="今日の計画を見る" onPress={onPressToday} />
              ) : null}
            </View>
          ) : saveState.status === 'stale' ? (
            <View style={styles.saveError} testID="planner-preview-stale">
              <Text style={styles.saveErrorTitle}>計画の再生成が必要です</Text>
              <Text style={styles.saveErrorText}>{saveState.message}</Text>
            </View>
          ) : saveState.status === 'error' ? (
            <View
              style={styles.saveError}
              testID={
                saveState.kind === 'verification'
                  ? 'planner-approval-check-error'
                  : 'planner-save-error'
              }
            >
              <Text style={styles.saveErrorTitle}>
                {saveState.kind === 'verification'
                  ? '最新の状況を確認できませんでした'
                  : '計画を保存できませんでした'}
              </Text>
              <Text style={styles.saveErrorText}>{saveState.message}</Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            {saveState.status !== 'success' && saveState.status !== 'stale' ? (
              <ActionButton
                accessibilityLabel={
                  saveState.status === 'error'
                    ? saveState.kind === 'verification'
                      ? '計画の承認を再試行する'
                      : '計画の保存を再試行する'
                    : 'この計画を保存する'
                }
                disabled={!canApprove}
                label={
                  saveState.status === 'saving'
                    ? '確認・保存中…'
                    : saveState.status === 'error'
                      ? saveState.kind === 'verification'
                        ? '承認を再試行'
                        : '保存を再試行'
                      : 'この計画を保存'
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
              label={mode === 'replan' ? '再計画をキャンセル' : 'プレビューを閉じる'}
              onPress={() => {
                discard();
                if (mode === 'replan') onCancelReplan?.();
              }}
              variant="ghost"
            />
          </View>
        </>
      ) : (
        <View style={styles.introCard} testID="planner-idle-state">
          <Text style={styles.introTitle}>
            {mode === 'replan'
              ? '今日の残り時間で計画を組み直します'
              : '今日使える時間から計画を作ります'}
          </Text>
          <Text style={styles.introText}>
            Goals・Tasksの登録内容とCalendarの空き時間から提案します。内容を確認してから保存するので、作成しただけでは今日の計画は変わりません。
          </Text>
          <ActionButton
            accessibilityLabel={
              mode === 'replan' ? '今日の残り時間を再計画する' : '今日の計画を作成する'
            }
            disabled={!canGenerate}
            label={mode === 'replan' ? '残り時間の計画を作成' : '今日の計画を作成'}
            onPress={() => void generate()}
            style={styles.createButton}
          />
        </View>
      )}
      {mode === 'replan' && state.status !== 'success' ? (
        <ActionButton
          label="再計画をキャンセル"
          disabled={saveState.status === 'saving'}
          onPress={() => {
            discard();
            onCancelReplan?.();
          }}
          variant="ghost"
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  unavailableProvider: { opacity: 0.6 },
  providerOptions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  providerHeading: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  providerOption: {
    minHeight: 60,
    gap: spacing.xs,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  selectedProviderOption: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  providerTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  providerDescription: {
    lineHeight: 20,
    color: colors.textMuted,
    fontSize: 12,
  },
  providerLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.md,
  },
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
