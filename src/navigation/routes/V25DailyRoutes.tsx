import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { useAuth } from '@/features/auth';
import { nextCalendarWindow } from '@/features/calendar/recommendationCalendar';
import { DayAgenda, type CalendarEvent } from '@/features/calendar';
import { CalendarDateNavigator } from '@/features/calendar/components/CalendarDateNavigator';
import { EventEditor } from '@/features/planner/v2/EventEditor';
import { TodayRecommendationsScreen } from '@/features/recommendations/TodayRecommendationsScreen';
import {
  DEFAULT_CONDITIONS,
  isEffort,
  type Conditions,
} from '@/features/recommendations/repository';
import { addLocalDays, getUtcDayBounds, type LocalDate } from '@/features/today';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StatePanel } from '@/shared/components/StatePanel';
import { useTheme } from '@/shared/theme';
import { createExpoCalendarRepository } from '@/services/calendar/ExpoCalendarRepository';
import { createSupabaseFixedEventRepository } from '@/services/supabase/repositories/SupabaseFixedEventRepository';
import { createSupabaseRecommendationRepository } from '@/services/supabase/repositories/SupabaseRecommendationRepository';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';
import { createSupabaseTaskRepository } from '@/services/supabase/repositories/SupabaseTaskRepository';

import { useV25Date } from './useV25Date';

function readConditions(key: string): Conditions {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (
      stored &&
      (stored.minutes === 15 || stored.minutes === 30 || stored.minutes === 60) &&
      isEffort(stored.effort)
    )
      return { minutes: stored.minutes, effort: stored.effort };
  } catch {
    // A fresh installation or unavailable storage can use the default selections.
  }
  return DEFAULT_CONDITIONS;
}

function DailyRoute({ mode, userId }: { mode: 'today' | 'calendar'; userId: string }) {
  const router = useRouter();
  const { spacing } = useTheme();
  const { settings, fixed, calendar, repository, taskRepository } = useMemo(
    () => ({
      settings: createSupabaseSettingsRepository(userId),
      fixed: createSupabaseFixedEventRepository(userId),
      calendar: createExpoCalendarRepository(),
      repository: createSupabaseRecommendationRepository(userId),
      taskRepository: createSupabaseTaskRepository(userId),
    }),
    [userId],
  );
  const { date: today, timezone, revision, error, refresh, now } = useV25Date(settings);
  const [device, setDevice] = useState<{
    date: string;
    events: CalendarEvent[];
    available: boolean;
  }>();
  const openChat = (day: string) =>
    router.push({ pathname: '/ai', params: { date: day, entry: String(Date.now()) } });
  const [selected, setSelected] = useState<LocalDate>();
  const [editDate, setEditDate] = useState<string>();
  const key = `v25-recommendation-conditions:${userId}`;
  const [initialConditions] = useState(() =>
    mode === 'today' ? readConditions(key) : DEFAULT_CONDITIONS,
  );
  const settingsButton = (
    <ActionButton label="設定" variant="ghost" onPress={() => router.push('/settings')} />
  );

  if (!today || !timezone) {
    return (
      <AppScreen>
        <ScreenHeader title={mode === 'today' ? '今日' : '予定'} action={settingsButton} />
        <StatePanel
          testID="daily-profile-state"
          title={error ? '表示日を確認できませんでした' : '読み込み中'}
          message={error || '設定したタイムゾーンを確認しています。'}
          isLoading={!error}
          actionLabel={error ? '再試行' : undefined}
          onPressAction={error ? refresh : undefined}
        />
      </AppScreen>
    );
  }
  const date = mode === 'calendar' ? (selected ?? today) : today;
  const agenda = (
    <DayAgenda
      date={date}
      timezone={timezone}
      revision={revision}
      calendar={calendar}
      fixed={fixed}
      now={mode === 'today' ? +now : undefined}
      onDeviceEvents={mode === 'today' ? setDevice : undefined}
      summary={mode === 'today'}
      onOpenCalendar={mode === 'today' ? () => router.navigate('/calendar') : undefined}
    />
  );
  if (mode === 'today') {
    return (
      <TodayRecommendationsScreen
        timezone={timezone}
        date={date}
        revision={revision}
        repository={repository}
        taskRepository={taskRepository}
        agenda={agenda}
        calendarWindow={
          device?.date === date && device.available
            ? nextCalendarWindow(
                device.events,
                +now,
                Date.parse(getUtcDayBounds(date, timezone).endAt),
              )
            : undefined
        }
        openChat={() => openChat(date)}
        initialConditions={initialConditions}
        saveConditions={(value) => {
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch {
            // Keep using the selected values in this session.
          }
        }}
        openSettings={() => router.push('/settings')}
        openTasks={(filter) =>
          router.navigate({
            pathname: '/tasks',
            params: { filter, entry: String(Date.now()) },
          })
        }
        openStep={(taskId, minutes) =>
          router.push({ pathname: '/action-steps', params: { taskId, minutes: String(minutes) } })
        }
      />
    );
  }
  return (
    <AppScreen contentContainerStyle={{ gap: spacing.md }}>
      <ScreenHeader title="予定" action={settingsButton} />
      <CalendarDateNavigator
        selectedDate={date}
        timeZone={timezone}
        isToday={date === today}
        onNext={() => setSelected(addLocalDays(date, 1))}
        onPrevious={() => setSelected(addLocalDays(date, -1))}
        onToday={() => setSelected(undefined)}
      />
      <ActionButton label="予定を追加" variant="secondary" onPress={() => setEditDate(date)} />
      {agenda}
      <ActionButton label="この日の予定をAIに相談" variant="ghost" onPress={() => openChat(date)} />
      {editDate ? (
        <EventEditor
          fixedOnly
          date={editDate}
          timezone={timezone}
          close={() => setEditDate(undefined)}
          save={async (event) => {
            try {
              await fixed.add(editDate, event);
              refresh();
            } catch {
              throw new Error('予定を保存できませんでした。再試行してください。');
            }
          }}
        />
      ) : null}
    </AppScreen>
  );
}

export function TodayRoute() {
  const userId = useAuth().session?.user.id;
  return userId ? <DailyRoute key={userId} mode="today" userId={userId} /> : null;
}

export function CalendarRoute() {
  const userId = useAuth().session?.user.id;
  return userId ? <DailyRoute key={userId} mode="calendar" userId={userId} /> : null;
}
