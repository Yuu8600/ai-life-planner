import { useCallback, useEffect, useState } from 'react';

import { getTodayErrorMessage } from './errors';
import type { TodayProjection, TodayRepository } from './repositories/TodayRepository';

export function useToday(repository: TodayRepository | null, refreshToken = 0) {
  const [today, setToday] = useState<TodayProjection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isActive = true;

    if (!repository) {
      void Promise.resolve().then(() => {
        if (isActive) {
          setToday(null);
          setLoadError('今日の予定を表示するにはログインが必要です。');
          setIsLoading(false);
        }
      });

      return () => {
        isActive = false;
      };
    }

    void Promise.resolve().then(() => {
      if (isActive) {
        setIsLoading(true);
        setLoadError(null);
      }
    });

    void repository
      .getToday()
      .then((loadedToday) => {
        if (isActive) {
          setToday(loadedToday);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setToday(null);
          setLoadError(getTodayErrorMessage(error));
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [loadAttempt, refreshToken, repository]);

  const retry = useCallback(() => {
    if (!repository) return;
    setIsLoading(true);
    setLoadError(null);
    setLoadAttempt((current) => current + 1);
  }, [repository]);

  return { isLoading, loadError, retry, today };
}
