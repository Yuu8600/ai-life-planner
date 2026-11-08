import { EventBufferEditor } from './components/EventBufferEditor';
import { bufferKey, eventBufferKey, type CalendarEventBufferRepository } from './eventBuffers';
import { isBlockingCalendarEvent, calculateFreeTime } from '@/features/planner';
import type { CalendarEvent } from './types';
import { StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '@/shared/theme';
import { useMemo, useState } from 'react';

import { getLocalDate } from '@/features/today';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';

import type { SettingsRepository } from '@/features/settings';

import { CalendarDateNavigator } from './components/CalendarDateNavigator';
import { CalendarStatePanel } from './components/CalendarStatePanel';
import { DayTimeline } from './components/DayTimeline';
import { FreeTimeSummary } from './components/FreeTimeSummary';
import { toCalendarEventViewModel } from './presentation';
import type { CalendarRepository } from './repositories/CalendarRepository';
import { useDeviceCalendar } from './useDeviceCalendar';

type CalendarScreenProps = {
  eventBufferRepository?: CalendarEventBufferRepository | null;
  sourceLabel?: 'device' | 'demo';
  calendarRepository: CalendarRepository | null;
  now?: () => Date;
  onOpenSettings?: () => void;
  refreshToken?: number;
  settingsRepository: SettingsRepository | null;
};

export function CalendarScreen({
  eventBufferRepository,
  sourceLabel = 'device',
  calendarRepository,
  now,
  onOpenSettings,
  refreshToken = 0,
  settingsRepository,
}: CalendarScreenProps) {
  const calendar = useDeviceCalendar(
    calendarRepository,
    settingsRepository,
    refreshToken,
    now,
    eventBufferRepository,
  );
  const [editing, setEditing] = useState<{ event: CalendarEvent; date: string } | null>(null);
  const selectedDate = calendar.selectedDate;
  const timeZone = calendar.timeZone;
  const eventViewModels =
    selectedDate && timeZone
      ? calendar.events.map((event) => toCalendarEventViewModel(event, selectedDate, timeZone))
      : [];
  const freeTimeCalculation = useMemo(() => {
    if (!selectedDate || !timeZone || !calendar.planningSettings) return null;

    try {
      return {
        error: null,
        result: calculateFreeTime({
          events: calendar.calculationEvents,
          planningEndDayOffset: calendar.planningSettings.planningEndDayOffset,
          calendarEventBufferOverrides: calendar.overrides,
          calendarBufferBeforeMinutes: calendar.planningSettings.calendarBufferBeforeMinutes,
          calendarBufferAfterMinutes: calendar.planningSettings.calendarBufferAfterMinutes,
          minimumFreeMinutes: calendar.planningSettings.minimumFreeMinutes,
          planningEnd: calendar.planningSettings.planningEnd,
          planningStart: calendar.planningSettings.planningStart,
          selectedDate,
          timezone: timeZone,
        }),
      };
    } catch {
      return {
        error: 'プロフィールの設定と予定を確認してください。',
        result: null,
      };
    }
  }, [
    calendar.calculationEvents,
    calendar.overrides,
    calendar.planningSettings,
    selectedDate,
    timeZone,
  ]);
  const canShowFreeTime =
    calendar.accessState === 'granted' &&
    !calendar.isLoadingEvents &&
    calendar.calendarCount !== null &&
    !calendar.loadError;

  return (
    <AppScreen testID="calendar-screen" contentContainerStyle={styles.content}>
      <ScreenHeader title="カレンダー" />

      {calendar.accessState === 'granted' && selectedDate && timeZone ? (
        <CalendarDateNavigator
          isToday={selectedDate === getLocalDate(now ? now() : new Date(), timeZone)}
          onNext={calendar.goToNextDay}
          onPrevious={calendar.goToPreviousDay}
          onToday={calendar.goToToday}
          selectedDate={selectedDate}
          timeZone={timeZone}
        />
      ) : null}

      {editing &&
      editing.date === selectedDate &&
      eventBufferRepository &&
      calendar.planningSettings &&
      timeZone &&
      !calendar.loadError ? (
        <EventBufferEditor
          key={bufferKey(eventBufferKey(editing.event))}
          event={editing.event}
          timeLabel={toCalendarEventViewModel(editing.event, editing.date, timeZone).timeLabel}
          commonBefore={calendar.planningSettings.calendarBufferBeforeMinutes}
          commonAfter={calendar.planningSettings.calendarBufferAfterMinutes}
          individual={calendar.overrides.find(
            (value) => bufferKey(value) === bufferKey(eventBufferKey(editing.event)),
          )}
          repository={eventBufferRepository}
          onClose={() => setEditing(null)}
          onSaved={calendar.retry}
        />
      ) : null}
      {calendar.accessState === 'checking' ? (
        <CalendarStatePanel
          isLoading
          message="プロフィール設定とカレンダー権限を確認しています。"
          testID="calendar-checking-state"
          title="確認中"
        />
      ) : calendar.accessState === 'undetermined' ? (
        <CalendarStatePanel
          actionLabel={calendar.isRequestingPermission ? '確認中…' : 'アクセスを許可する'}
          disabled={calendar.isRequestingPermission}
          message="予定との重なりを確認するため、端末カレンダーの読み取り権限が必要です。予定の追加・変更・削除は行いません。"
          onPressAction={() => void calendar.requestPermission()}
          testID="calendar-permission-prompt"
          title="カレンダーへのアクセス"
        />
      ) : calendar.accessState === 'denied' ? (
        <CalendarStatePanel
          actionLabel={calendar.canAskAgain ? 'もう一度許可する' : 'OS設定を開く'}
          disabled={calendar.isRequestingPermission}
          message={
            calendar.canAskAgain
              ? 'カレンダーを表示するにはアクセスの許可が必要です。'
              : 'カレンダーへのアクセスが拒否されています。OS設定でこのアプリのカレンダー権限を許可してください。'
          }
          onPressAction={
            calendar.canAskAgain ? () => void calendar.requestPermission() : onOpenSettings
          }
          testID="calendar-permission-denied"
          title="カレンダーを表示できません"
        />
      ) : calendar.accessState === 'unavailable' ? (
        <CalendarStatePanel
          message={
            calendar.loadError ??
            'このビルドでは端末カレンダーを利用できません。development buildで開いてください。'
          }
          testID="calendar-unavailable-state"
          title="端末カレンダーを利用できません"
        />
      ) : calendar.accessState === 'error' ? (
        <CalendarStatePanel
          actionLabel={calendarRepository && settingsRepository ? '再読み込み' : undefined}
          message={calendar.loadError ?? 'カレンダーを読み込めませんでした。'}
          onPressAction={calendarRepository && settingsRepository ? calendar.retry : undefined}
          testID="calendar-error-state"
          title={calendarRepository && settingsRepository ? '読み込みエラー' : 'ログインが必要です'}
        />
      ) : calendar.isLoadingEvents || (calendar.calendarCount === null && !calendar.loadError) ? (
        <CalendarStatePanel
          isLoading
          message="端末カレンダーから選択日の予定を取得しています。"
          testID="calendar-loading-state"
          title="予定を読み込み中"
        />
      ) : calendar.loadError ? (
        <CalendarStatePanel
          actionLabel="再読み込み"
          message={calendar.loadError}
          onPressAction={calendar.retry}
          testID="calendar-error-state"
          title="予定を読み込めませんでした"
        />
      ) : calendar.calendarCount === 0 ? (
        <CalendarStatePanel
          message="読み取り可能な予定カレンダーが端末にありません。"
          testID="calendar-no-calendars-state"
          title="カレンダーがありません"
        />
      ) : calendar.events.length === 0 ? (
        <CalendarStatePanel
          message="選択した日には表示できる予定がありません。"
          testID="calendar-empty-state"
          title="予定はありません"
        />
      ) : (
        <DayTimeline
          events={eventViewModels}
          editableKeys={calendar.events.flatMap((event, index) =>
            !event.allDay && isBlockingCalendarEvent(event) ? [eventViewModels[index].key] : [],
          )}
          individualKeys={calendar.events.flatMap((event, index) =>
            !event.allDay &&
            isBlockingCalendarEvent(event) &&
            calendar.overrides.some(
              (value) => bufferKey(value) === bufferKey(eventBufferKey(event)),
            )
              ? [eventViewModels[index].key]
              : [],
          )}
          onEditBuffer={
            eventBufferRepository
              ? (key) => {
                  const index = eventViewModels.findIndex((value) => value.key === key);
                  if (index >= 0 && selectedDate)
                    setEditing({ event: calendar.events[index], date: selectedDate });
                }
              : undefined
          }
          sourceLabel={sourceLabel === 'demo' ? 'サンプルカレンダー' : undefined}
        />
      )}

      {canShowFreeTime && freeTimeCalculation?.result && timeZone ? (
        <>
          {calendar.planningSettings?.calendarBufferBeforeMinutes ||
          calendar.planningSettings?.calendarBufferAfterMinutes ||
          calendar.overrides.length > 0 ? (
            <Text style={styles.caption}>予定前後の余白時間を除いて計算しています。</Text>
          ) : null}
          <FreeTimeSummary result={freeTimeCalculation.result} timezone={timeZone} />
        </>
      ) : canShowFreeTime && freeTimeCalculation?.error ? (
        <CalendarStatePanel
          message={freeTimeCalculation.error}
          testID="calendar-free-time-error"
          title="空き時間を計算できませんでした"
        />
      ) : null}
      <Text style={styles.caption}>
        {sourceLabel === 'demo'
          ? 'サンプル予定を表示しています。'
          : '端末カレンダーは読み取り専用です。'}
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 880, alignSelf: 'center', gap: spacing.lg },
  caption: { ...typography.secondary, color: colors.textSecondary },
});
