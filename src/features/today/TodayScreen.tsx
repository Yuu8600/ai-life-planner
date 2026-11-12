import { useMemo } from 'react';
import type { SettingsRepository } from '@/features/settings';
import { useTodayCalendar } from './useTodayCalendar';
import { currentInstant, useTimelineClock } from './useTimelineClock';
import { resolveAxisWindow, unallocatedSlots } from './timeAxis';
import { getLocalDate, formatLocalTimeJa } from './timezone';
import { type CalendarRepository, type CalendarEventBufferRepository } from '@/features/calendar';
import { Pressable, StyleSheet, Text } from 'react-native';

import {
  ActivityLogSection,
  useActivityLogs,
  type ActivityLogRepository,
} from '@/features/activity';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { appAlert } from '@/shared/feedback/appAlert';
import { colors, radius, spacing } from '@/shared/theme';

import { formatTodayDateLabel, toDeadlineTaskItems, toTimelineItems } from './presentation';
import type { TodayRepository } from './repositories/TodayRepository';
import type { PlannedActionExecutionRepository } from './repositories/PlannedActionExecutionRepository';
import { useToday } from './useToday';
import { usePlannedActionExecution } from './usePlannedActionExecution';

import { Timeline } from './components/Timeline';
import { TodayStatePanel } from './components/TodayStatePanel';
import { DeadlineTaskList } from './components/DeadlineTaskList';

type TodayScreenProps = {
  settingsRepository?: SettingsRepository | null;
  eventBufferRepository?: CalendarEventBufferRepository | null;
  now?: () => Date;
  calendarRepository?: CalendarRepository | null;
  onPressReplan?: () => void;
  replanHint?: string;
  onPressAi: () => void;
  onPressSettings: () => void;
  refreshToken?: number;
  isFocused?: boolean;
  repository: TodayRepository | null;
  executionRepository?: PlannedActionExecutionRepository | null;
  activityLogRepository?: ActivityLogRepository | null;
};

export function TodayScreen({
  calendarRepository = null,
  settingsRepository = null,
  eventBufferRepository = null,
  now = currentInstant,
  onPressReplan,
  replanHint,
  onPressAi,
  onPressSettings,
  refreshToken = 0,
  isFocused = false,
  repository,
  executionRepository = null,
  activityLogRepository = null,
}: TodayScreenProps) {
  const { dataRevision, isLoading, loadError, refresh, retry, today } = useToday(
    repository,
    refreshToken,
  );
  // Each visit can scroll once, even if the timeline is replaced during that visit.
  const focusScroll = useMemo(() => {
    if (!isFocused) return undefined;
    let pending = true;
    return {
      isPending: () => pending,
      consume: () => {
        pending = false;
      },
    };
  }, [isFocused]);
  const displayTimezone = today?.profileTimezone ?? 'UTC';
  const axisWindow = today
    ? resolveAxisWindow(
        today.localDate,
        today.plan?.timezone ?? displayTimezone,
        today.plan?.window,
        today.planningWindow,
      )
    : undefined;
  const instant = useTimelineClock(now, refreshToken);
  const calendar = useTodayCalendar(
    calendarRepository,
    settingsRepository,
    eventBufferRepository,
    today?.localDate ?? null,
    today?.profileTimezone ?? null,
    axisWindow,
    dataRevision,
    now,
  );
  const freeSlots =
    !isLoading && !loadError && calendar.availability
      ? unallocatedSlots(
          calendar.availability.result.freeSlots,
          today?.plan?.actions ?? [],
          calendar.availability.minimum,
          instant,
        )
      : [];
  const activity = useActivityLogs(activityLogRepository, today?.localDate ?? null, dataRevision);
  const { execute, mutations } = usePlannedActionExecution(executionRepository, refresh);
  const timelineItems = today?.plan ? toTimelineItems(today.plan, displayTimezone) : [];
  const deadlineTaskItems = today ? toDeadlineTaskItems(today.deadlineTasks) : [];
  const completedActions = today?.plan?.actions.filter(
    (action) => action.status === 'completed',
  ).length;

  const currentWindow = today?.planningWindow;
  const savedWindow = today?.plan?.window;
  const configuredWindow = currentWindow ?? savedWindow;
  const windowDiffers =
    currentWindow &&
    savedWindow &&
    (Date.parse(currentWindow.startAt) !== Date.parse(savedWindow.startAt) ||
      Date.parse(currentWindow.endAt) !== Date.parse(savedWindow.endAt));
  let outsideActions = 0;
  let clippedActions = 0;
  if (currentWindow && today?.plan) {
    const windowStart = Date.parse(currentWindow.startAt);
    const windowEnd = Date.parse(currentWindow.endAt);
    for (const action of today.plan.actions) {
      const start = Date.parse(action.startAt);
      const end = Date.parse(action.endAt);
      if (end <= windowStart || start >= windowEnd) {
        outsideActions += 1;
      } else if (start < windowStart || end > windowEnd) {
        clippedActions += 1;
      }
    }
  }

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
        subtitle={
          today &&
          configuredWindow &&
          getLocalDate(configuredWindow.endAt, displayTimezone) > today.localDate
            ? `${today.localDate}の計画（翌日${formatLocalTimeJa(configuredWindow.endAt, displayTimezone)}まで）`
            : undefined
        }
        title="今日の予定"
      />

      {isLoading && !today ? (
        <TodayStatePanel
          isLoading
          message="保存した計画と今日が期限のタスクを確認しています。"
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
          {today.plan && today.plan.timezone !== today.profileTimezone ? (
            <Text style={{ color: colors.textMuted }}>時刻表示: {displayTimezone}</Text>
          ) : null}
          {windowDiffers ? (
            <Text style={{ color: colors.textMuted }}>
              時間軸は現在の活動時間を表示しています。保存済み計画の活動時間とは異なります。
            </Text>
          ) : null}
          {outsideActions || clippedActions ? (
            <Text style={{ color: colors.textMuted }}>
              {outsideActions ? `時間軸の表示範囲外にActionが${outsideActions}件あります。` : ''}
              {clippedActions ? `一部が範囲外のActionは${clippedActions}件です。` : ''}
              「予定の詳細・操作」で元の時刻を確認・操作できます。
              {onPressReplan ? '計画を見直すには「再計画する」を選んでください。' : ''}
            </Text>
          ) : null}
          {calendar.message ? (
            <Text style={{ color: colors.textMuted }}>{calendar.message}</Text>
          ) : null}
          {today.plan ? (
            <>
              {today.plan.actions.length === 0 && calendar.events.length > 0 ? (
                <Text>予定されたアクションはありません</Text>
              ) : null}
              <Timeline
                completedActions={completedActions ?? 0}
                totalActions={today.plan.actions.length}
                supplement={
                  <>
                    <Text style={{ color: colors.textMuted }}>
                      {today.plan.summary ?? '今日の実行予定を確認しましょう。'}
                    </Text>
                    {onPressReplan && replanHint ? (
                      <Text style={{ color: colors.textMuted }}>{replanHint}</Text>
                    ) : null}
                    {onPressReplan ? (
                      <ActionButton
                        label="再計画する"
                        onPress={onPressReplan}
                        disabled={
                          isLoading ||
                          Boolean(loadError) ||
                          Object.values(mutations).some(
                            (mutation) => mutation.status === 'updating',
                          )
                        }
                        variant="ghost"
                      />
                    ) : null}

                    <SectionHeader
                      detail={`${deadlineTaskItems.length}件`}
                      title="今日が期限のタスク"
                    />
                    <DeadlineTaskList items={deadlineTaskItems} />
                  </>
                }
                focusScroll={focusScroll}
                isLoading={isLoading}
                window={axisWindow}
                now={instant}
                freeSlots={freeSlots}
                availabilityMessage={calendar.availabilityMessage}
                items={timelineItems}
                calendarEvents={calendar.events.map((event) => ({
                  ...event,
                  canceled: event.status === 'canceled',
                }))}
                actionStarts={Object.fromEntries(
                  today.plan.actions.map((action) => [action.id, action.startAt]),
                )}
                localDate={today.localDate}
                timezone={displayTimezone}
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
                          appAlert.alert(
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
              {today.plan.actions.length === 0 && calendar.events.length === 0 ? (
                <TodayStatePanel
                  message="計画は保存されていますが、予定されたActionはありません。"
                  testID="today-plan-actions-empty"
                  title="予定されたアクションはありません"
                />
              ) : null}
            </>
          ) : (
            <>
              <TodayStatePanel
                actionLabel="今日の計画を作成"
                onPressAction={onPressAi}
                message="Calendarと空き時間を確認して、計画を作成できます。"
                testID="today-plan-empty-state"
                title="今日の計画はまだありません"
              />
            </>
          )}

          {!today.plan ? (
            <Timeline
              focusScroll={focusScroll}
              isLoading={isLoading}
              window={axisWindow}
              now={instant}
              freeSlots={freeSlots}
              availabilityMessage={calendar.availabilityMessage}
              items={[]}
              calendarEvents={calendar.events.map((event) => ({
                ...event,
                canceled: event.status === 'canceled',
              }))}
              localDate={today.localDate}
              timezone={displayTimezone}
            />
          ) : null}
          {!today.plan ? (
            <>
              <SectionHeader detail={`${deadlineTaskItems.length}件`} title="今日が期限のタスク" />
              <DeadlineTaskList items={deadlineTaskItems} />
            </>
          ) : null}
          <ActivityLogSection state={activity.state} onRetry={activity.retry} />
        </>
      ) : null}

      <ActionButton
        accessibilityLabel="Plannerで今日の計画を作成する"
        label="Plannerを開く"
        onPress={onPressAi}
        variant="secondary"
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
