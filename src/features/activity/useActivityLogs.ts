import { useCallback, useEffect, useState } from 'react';

import { addLocalDays } from '@/features/today';

import type { ActivityLog, ActivityLogRepository } from './repositories/ActivityLogRepository';

export type ActivityLogsState =
  { status: 'idle' | 'loading' } | { status: 'success'; logs: ActivityLog[] } | { status: 'error' };

export function useActivityLogs(
  repository: ActivityLogRepository | null,
  date: string | null,
  revision = 0,
) {
  const [state, setState] = useState<ActivityLogsState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      if (!repository || !date) {
        setState({ status: 'idle' });
        return;
      }
      setState({ status: 'loading' });
      try {
        const logs = await repository.listForPlanDate(addLocalDays(date, 0));
        if (active) setState({ status: 'success', logs });
      } catch {
        if (active) setState({ status: 'error' });
      }
    });
    return () => {
      active = false;
    };
  }, [attempt, date, repository, revision]);
  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  return { retry, state };
}
