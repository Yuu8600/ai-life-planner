import type { CalendarEventBufferRepository, CalendarEventBufferOverride } from './eventBuffers';
import { loadCalendarPlanningEvents } from './loadCalendarPlanningEvents';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ProfilePlanningSettings, SettingsRepository } from '@/features/settings';
import { addLocalDays, getLocalDate, resolveTimeZone, type LocalDate } from '@/features/today';

import { CalendarUnavailableError, getCalendarErrorMessage } from './errors';
import type { CalendarRepository } from './repositories/CalendarRepository';
import type { CalendarEvent } from './types';

export type CalendarAccessState =
  'checking' | 'denied' | 'error' | 'granted' | 'unavailable' | 'undetermined';

export type UseDeviceCalendarResult = {
  accessState: CalendarAccessState;
  calendarCount: number | null;
  canAskAgain: boolean;
  events: CalendarEvent[];
  calculationEvents: CalendarEvent[];
  overrides: CalendarEventBufferOverride[];
  goToNextDay: () => void;
  goToPreviousDay: () => void;
  goToToday: () => void;
  isLoadingEvents: boolean;
  isRequestingPermission: boolean;
  loadError: string | null;
  planningSettings: ProfilePlanningSettings | null;
  requestPermission: () => Promise<void>;
  retry: () => void;
  selectedDate: LocalDate | null;
  timeZone: string | null;
};

const getCurrentDate = () => new Date();

function isUnavailable(error: unknown): boolean {
  return error instanceof CalendarUnavailableError;
}

export function useDeviceCalendar(
  calendarRepository: CalendarRepository | null,
  settingsRepository: SettingsRepository | null,
  refreshToken = 0,
  now: () => Date = getCurrentDate,
  eventBufferRepository?: CalendarEventBufferRepository | null,
): UseDeviceCalendarResult {
  const [accessState, setAccessState] = useState<CalendarAccessState>('checking');
  const [calendarCount, setCalendarCount] = useState<number | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(false);
  const [overrides, setOverrides] = useState<CalendarEventBufferOverride[]>([]);
  const [calculationEvents, setCalculationEvents] = useState<CalendarEvent[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const [eventLoadAttempt, setEventLoadAttempt] = useState(0);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [planningSettings, setPlanningSettings] = useState<ProfilePlanningSettings | null>(null);
  const [selectedDate, setSelectedDate] = useState<LocalDate | null>(null);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const isRequestingRef = useRef(false);

  useEffect(() => {
    let isActive = true;

    void Promise.resolve().then(() => {
      if (!isActive) return;
      setAccessState('checking');
      setCalendarCount(null);
      setCanAskAgain(false);
      setEvents([]);
      setCalculationEvents([]);
      setOverrides([]);
      setIsLoadingEvents(false);
      setLoadError(null);
      setPlanningSettings(null);
      setSelectedDate(null);
      setTimeZone(null);
    });

    if (!calendarRepository || !settingsRepository) {
      void Promise.resolve().then(() => {
        if (!isActive) return;
        setAccessState('error');
        setLoadError('カレンダーを表示するにはログインが必要です。');
      });
      return () => {
        isActive = false;
      };
    }

    Promise.all([
      settingsRepository.getProfilePlanningSettings(),
      calendarRepository.getPermission(),
    ])
      .then(([settings, permission]) => {
        if (!isActive) return;

        const canonicalTimeZone = resolveTimeZone(settings.timezone);
        setPlanningSettings({ ...settings, timezone: canonicalTimeZone });
        setTimeZone(canonicalTimeZone);
        setSelectedDate(getLocalDate(now(), canonicalTimeZone));
        setCanAskAgain(permission.canAskAgain);
        setAccessState(permission.status);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setLoadError(getCalendarErrorMessage(error));
        setAccessState(isUnavailable(error) ? 'unavailable' : 'error');
      });

    return () => {
      isActive = false;
    };
  }, [calendarRepository, initializationAttempt, now, refreshToken, settingsRepository]);

  useEffect(() => {
    if (
      accessState !== 'granted' ||
      !calendarRepository ||
      !selectedDate ||
      !timeZone ||
      !planningSettings
    ) {
      return;
    }

    let isActive = true;
    void Promise.resolve().then(() => {
      if (!isActive) return;
      setCalendarCount(null);
      setEvents([]);
      setCalculationEvents([]);
      setOverrides([]);
      setIsLoadingEvents(true);
      setLoadError(null);
    });

    loadCalendarPlanningEvents(
      calendarRepository,
      selectedDate,
      timeZone,
      planningSettings.calendarBufferBeforeMinutes,
      planningSettings.calendarBufferAfterMinutes,
      eventBufferRepository,
    )
      .then((result) => {
        if (!isActive) return;
        setCalendarCount(result.calendarCount);
        setEvents(result.events);
        setCalculationEvents(result.calculationEvents);
        setOverrides(result.overrides);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setLoadError(getCalendarErrorMessage(error));
        if (isUnavailable(error)) setAccessState('unavailable');
      })
      .finally(() => {
        if (isActive) setIsLoadingEvents(false);
      });

    return () => {
      isActive = false;
    };
  }, [
    accessState,
    calendarRepository,
    eventLoadAttempt,
    selectedDate,
    timeZone,
    planningSettings,
    eventBufferRepository,
  ]);

  const requestPermission = useCallback(async () => {
    if (!calendarRepository || isRequestingRef.current) return;

    isRequestingRef.current = true;
    setIsRequestingPermission(true);
    setLoadError(null);

    try {
      const permission = await calendarRepository.requestPermission();
      setCanAskAgain(permission.canAskAgain);
      setAccessState(permission.status);
    } catch (error) {
      setLoadError(getCalendarErrorMessage(error));
      setAccessState(isUnavailable(error) ? 'unavailable' : 'error');
    } finally {
      isRequestingRef.current = false;
      setIsRequestingPermission(false);
    }
  }, [calendarRepository]);

  const selectRelativeDay = useCallback((amount: number) => {
    setSelectedDate((current) => (current ? addLocalDays(current, amount) : current));
  }, []);

  const goToPreviousDay = useCallback(() => selectRelativeDay(-1), [selectRelativeDay]);
  const goToNextDay = useCallback(() => selectRelativeDay(1), [selectRelativeDay]);
  const goToToday = useCallback(() => {
    if (timeZone) setSelectedDate(getLocalDate(now(), timeZone));
  }, [now, timeZone]);
  const retry = useCallback(() => {
    if (accessState === 'granted') {
      setEventLoadAttempt((current) => current + 1);
    } else {
      setInitializationAttempt((current) => current + 1);
    }
  }, [accessState]);

  return {
    accessState,
    calendarCount,
    canAskAgain,
    events,
    calculationEvents,
    overrides,
    goToNextDay,
    goToPreviousDay,
    goToToday,
    isLoadingEvents,
    isRequestingPermission,
    loadError,
    planningSettings,
    requestPermission,
    retry,
    selectedDate,
    timeZone,
  };
}
