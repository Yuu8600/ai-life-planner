import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CalendarEventBufferRepository, CalendarRepository } from '@/features/calendar';
import type { SettingsRepository } from '@/features/settings';
import { Badge } from '@/shared/components/Badge';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { appAlert } from '@/shared/feedback/appAlert';
import { colors, radius, spacing, typography } from '@/shared/theme';
import { Notice } from '@/shared/components/Notice';

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
  eventBufferRepository?: CalendarEventBufferRepository | null;
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
  eventBufferRepository,
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
      eventBufferRepository,
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
    appAlert.alert(
      mode === 'replan' ? 'この再計画を保存しますか？' : 'この計画を保存しますか？',
      mode === 'replan'
        ? `今日の計画をこの内容に置き換えます。途中の予定も組み直されます。完了・スキップの履歴は残ります。${state.status === 'success' && state.proposal.actions.length === 0 ? '\n新しい予定は0件です。旧計画の予定もすべて削除されます。' : ''}`
        : '今日の既存の計画がある場合は、このプレビューの内容で置き換えます。',
      [
        { style: 'cancel', text: 'キャンセル' },
        { onPress: approve, text: '保存する' },
      ],
    );
  };

  const [focusedProvider, setFocusedProvider] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (
      state.status === 'success' ||
      state.status === 'error' ||
      ['success', 'stale', 'error'].includes(saveState.status)
    )
      scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [saveState.status, state.status]);
  const providerOptions = onSelectProvider ? (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="生成方法"
      style={styles.providerOptions}
      testID="planner-provider-options"
    >
      <Text style={styles.providerHeading}>生成方法</Text>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{
          checked: provider.id === 'rule-based',
          disabled: saveState.status === 'saving',
        }}
        disabled={saveState.status === 'saving'}
        onPress={() => onSelectProvider('rule-based')}
        onFocus={() => setFocusedProvider('rule-based')}
        onBlur={() => setFocusedProvider(null)}
        {...(Platform.OS === 'web'
          ? {
              'aria-checked': provider.id === 'rule-based',
              onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                if (event.key === 'Enter' && !(saveState.status === 'saving')) {
                  event.preventDefault();
                  onSelectProvider('rule-based');
                }
              },
            }
          : {})}
        style={[
          styles.providerOption,
          provider.id === 'rule-based' && styles.selectedProviderOption,
          focusedProvider === 'rule-based' && styles.focusedProvider,
        ]}
        testID="planner-provider-rule-based"
      >
        <Text style={styles.providerTitle}>
          {provider.id === 'rule-based' ? '◉' : '○'} ルールベース
        </Text>
        <Text style={styles.providerDescription}>API不要・標準</Text>
      </Pressable>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{
          checked: provider.id === 'openai',
          disabled: openAiAvailability !== 'available' || saveState.status === 'saving',
        }}
        disabled={openAiAvailability !== 'available' || saveState.status === 'saving'}
        onPress={() => onSelectProvider('openai')}
        onFocus={() => setFocusedProvider('openai')}
        onBlur={() => setFocusedProvider(null)}
        {...(Platform.OS === 'web'
          ? {
              'aria-checked': provider.id === 'openai',
              onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                if (
                  event.key === 'Enter' &&
                  !(openAiAvailability !== 'available' || saveState.status === 'saving')
                ) {
                  event.preventDefault();
                  onSelectProvider('openai');
                }
              },
            }
          : {})}
        style={[
          styles.providerOption,
          provider.id === 'openai' && styles.selectedProviderOption,
          focusedProvider === 'openai' && styles.focusedProvider,
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
    </View>
  ) : null;
  const saveFeedback =
    saveState.status === 'success' ? (
      <Notice
        tone="success"
        testID="planner-save-success"
        title="今日の計画を保存しました"
        message={`${saveState.plan.actionCount}件の予定を保存しました。Todayで確認できます。`}
        action={
          mode === 'generate' && onPressToday ? (
            <ActionButton label="今日の計画を見る" onPress={onPressToday} />
          ) : undefined
        }
      />
    ) : saveState.status === 'stale' ? (
      <View style={styles.feedback} testID="planner-preview-stale">
        <Notice tone="warning" title="計画の再生成が必要です" message={saveState.message} />
        <Text style={styles.introText}>
          最新の設定・予定・タスク・保存済み計画との整合性が失われたため、このプレビューは保存できません。「再生成」で最新の内容を確認してください。
        </Text>
        {saveState.issues.map((issue, index) => (
          <Text key={index} style={styles.issueText}>
            {issue.message}
          </Text>
        ))}
      </View>
    ) : saveState.status === 'error' ? (
      <Notice
        tone="error"
        testID={
          saveState.kind === 'verification' ? 'planner-approval-check-error' : 'planner-save-error'
        }
        title={
          saveState.kind === 'verification'
            ? '最新の状況を確認できませんでした'
            : '計画を保存できませんでした'
        }
        message={saveState.message}
      />
    ) : null;
  const footer =
    preview && saveState.status !== 'stale' && saveState.status !== 'success' ? (
      <View style={styles.saveArea} testID="planner-save-area">
        <Text accessibilityLiveRegion="polite" style={styles.providerDescription}>
          {mode === 'replan' ? '再計画・' : ''}
          {saveState.status === 'saving'
            ? '最新の内容を確認して保存しています'
            : saveState.status === 'error'
              ? '未保存・内容を保持しています'
              : '未保存・保存するとTodayに反映します'}
        </Text>
        <ActionButton
          accessibilityLabel={
            saveState.status === 'error'
              ? saveState.kind === 'verification'
                ? '計画の承認を再試行する'
                : '計画の保存を再試行する'
              : mode === 'replan'
                ? 'この再計画を保存する'
                : 'この計画を保存する'
          }
          disabled={!canApprove}
          loading={saveState.status === 'saving'}
          label={
            saveState.status === 'saving'
              ? '確認・保存中…'
              : saveState.status === 'error'
                ? saveState.kind === 'verification'
                  ? '承認を再試行'
                  : '保存を再試行'
                : mode === 'replan'
                  ? 'この再計画を保存'
                  : 'この計画を保存'
          }
          onPress={confirmApproval}
        />
      </View>
    ) : undefined;

  return (
    <AppScreen
      testID="planner-preview-screen"
      contentContainerStyle={styles.content}
      footer={footer}
      scrollRef={scrollRef}
    >
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
        <Badge label="3 保存" tone={saveState.status === 'success' ? 'success' : 'neutral'} />
      </View>

      {!preview ? providerOptions : null}

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
          {saveFeedback}
          <PlannerPreview isSaved={saveState.status === 'success'} preview={preview}>
            <View style={styles.actions}>
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
          </PlannerPreview>
          {providerOptions}
        </>
      ) : (
        <View style={styles.introCard} testID="planner-idle-state">
          <Text style={styles.introTitle}>
            {mode === 'replan'
              ? '今日の残り時間で計画を組み直します'
              : '今日使える時間から計画を作ります'}
          </Text>
          <Text style={styles.introText}>
            TasksとCalendarの空き時間から提案します。生成だけではTodayは変わりません。確認後に保存してください。
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
  content: { width: '100%', maxWidth: 880, alignSelf: 'center', gap: spacing.lg },
  flow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  unavailableProvider: { backgroundColor: colors.surfaceSubtle },
  providerOptions: { gap: spacing.sm },
  providerHeading: { ...typography.sectionTitle, color: colors.textPrimary },
  providerOption: {
    minHeight: 60,
    gap: spacing.xs,
    borderColor: colors.borderControl,
    borderRadius: radius.card,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  focusedProvider: {
    borderColor: colors.focusRing,
    ...Platform.select({
      web: {
        outlineColor: colors.focusRing,
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineOffset: 2,
      },
      default: { borderWidth: 2 },
    }),
  },
  selectedProviderOption: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  providerTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  providerDescription: { ...typography.secondary, color: colors.textSecondary },
  providerLabel: { ...typography.secondary, color: colors.textSecondary },
  introCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  introTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  introText: { ...typography.secondary, color: colors.textSecondary },
  createButton: { marginTop: spacing.sm },
  actions: { gap: spacing.sm },
  issueCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.errorSoft,
  },
  issueTitle: { ...typography.bodyStrong, color: colors.error },
  issueText: { ...typography.secondary, color: colors.warning },
  feedback: { gap: spacing.sm },
  saveArea: {
    gap: spacing.sm,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 880,
    alignSelf: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
});
