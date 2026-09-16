import { useMemo } from 'react';

import { calculateFreeTime } from '@/features/planner';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';

import type { SettingsRepository } from '@/features/settings';

import { CalendarDateNavigator } from './components/CalendarDateNavigator';
import { CalendarStatePanel } from './components/CalendarStatePanel';
import { DayTimeline } from './components/DayTimeline';
import { FreeTimeSummary } from './components/FreeTimeSummary';
import { getCalendarDateLabel, toCalendarEventViewModel } from './presentation';
import type { CalendarRepository } from './repositories/CalendarRepository';
import { useDeviceCalendar } from './useDeviceCalendar';

type CalendarScreenProps = {
  calendarRepository: CalendarRepository | null;
  now?: () => Date;
  onOpenSettings?: () => void;
  refreshToken?: number;
  settingsRepository: SettingsRepository | null;
};

export function CalendarScreen({
  calendarRepository,
  now,
  onOpenSettings,
  refreshToken = 0,
  settingsRepository,
}: CalendarScreenProps) {
  const calendar = useDeviceCalendar(calendarRepository, settingsRepository, refreshToken, now);
  const selectedDate = calendar.selectedDate;
  const timeZone = calendar.timeZone;
  const dateLabel =
    selectedDate && timeZone ? getCalendarDateLabel(selectedDate, timeZone) : undefined;
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
          events: calendar.events,
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
  }, [calendar.events, calendar.planningSettings, selectedDate, timeZone]);
  const canShowFreeTime =
    calendar.accessState === 'granted' &&
    !calendar.isLoadingEvents &&
    calendar.calendarCount !== null &&
    !calendar.loadError;

  return (
    <AppScreen testID="calendar-screen">
      <ScreenHeader
        eyebrow={dateLabel}
        subtitle="端末カレンダーの予定を読み取り専用で表示します。"
        title="カレンダー"
      />

      {calendar.accessState === 'granted' && calendar.selectedDate ? (
        <CalendarDateNavigator
          onNext={calendar.goToNextDay}
          onPrevious={calendar.goToPreviousDay}
          onToday={calendar.goToToday}
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
        <DayTimeline events={eventViewModels} />
      )}

      {canShowFreeTime && freeTimeCalculation?.result && timeZone ? (
        <FreeTimeSummary result={freeTimeCalculation.result} timezone={timeZone} />
      ) : canShowFreeTime && freeTimeCalculation?.error ? (
        <CalendarStatePanel
          message={freeTimeCalculation.error}
          testID="calendar-free-time-error"
          title="空き時間を計算できませんでした"
        />
      ) : null}
    </AppScreen>
  );
}
