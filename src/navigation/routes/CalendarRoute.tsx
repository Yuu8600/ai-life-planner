import { createSupabaseCalendarEventBufferRepository } from '@/services/supabase/repositories/SupabaseCalendarEventBufferRepository';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/features/auth';
import { CalendarScreen } from '@/features/calendar/CalendarScreen';
import { createExpoCalendarRepository } from '@/services/calendar/ExpoCalendarRepository';
import { createSupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';

export default function CalendarRoute() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const eventBufferRepository = useMemo(
    () => (userId ? createSupabaseCalendarEventBufferRepository(userId) : null),
    [userId],
  );
  const [refreshToken, setRefreshToken] = useState(0);
  const hasFocused = useRef(false);
  const calendarRepository = useMemo(() => createExpoCalendarRepository(), []);
  const settingsRepository = useMemo(
    () => (userId ? createSupabaseSettingsRepository(userId) : null),
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) {
        setRefreshToken((current) => current + 1);
      } else {
        hasFocused.current = true;
      }
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRefreshToken((current) => current + 1);
    });

    return () => subscription.remove();
  }, []);

  return (
    <CalendarScreen
      eventBufferRepository={eventBufferRepository}
      calendarRepository={calendarRepository}
      onOpenSettings={() => void Linking.openSettings()}
      refreshToken={refreshToken}
      settingsRepository={settingsRepository}
    />
  );
}
