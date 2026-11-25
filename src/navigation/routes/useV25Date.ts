import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import type { SettingsRepository } from '@/features/settings';
import { getLocalDate, resolveTimeZone } from '@/features/today';
import { getTaskErrorMessage } from '@/features/tasks/errors';

export function useV25Date(settings: SettingsRepository) {
  const [timezone, setTimezone] = useState<string>();
  const [now, setNow] = useState(() => new Date());
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const refresh = useCallback(() => {
    setNow(new Date());
    setRevision((value) => value + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      const timer = setInterval(() => setNow(new Date()), 20_000);
      return () => {
        clearInterval(timer);
        subscription.remove();
      };
    }, [refresh]),
  );

  useEffect(() => {
    let active = true;
    void settings
      .getProfilePlanningSettings()
      .then((profile) => {
        const value = resolveTimeZone(profile.timezone);
        if (active) {
          setTimezone(value);
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(getTaskErrorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [settings, revision]);

  return {
    timezone,
    now,
    date: timezone ? getLocalDate(now, timezone) : null,
    revision,
    error,
    refresh,
  };
}
