import { useCallback, useEffect, useRef, useState } from 'react';

import { getTodayErrorMessage } from './errors';
import type { TodayProjection, TodayRepository } from './repositories/TodayRepository';

export function useToday(repository: TodayRepository | null, refreshToken = 0) {
  const [today, setToday] = useState<TodayProjection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataRevision, setDataRevision] = useState(0);
  const loadVersion = useRef(0);
  const latestLoad = useRef<Promise<boolean> | null>(null);

  const refresh = useCallback((): Promise<boolean> => {
    if (!repository) return Promise.resolve(false);
    const activeVersion = ++loadVersion.current;
    setIsLoading(true);
    setLoadError(null);
    const operation = (async () => {
      try {
        const loadedToday = await repository.getToday();
        if (loadVersion.current !== activeVersion) return latestLoad.current ?? false;
        setToday(loadedToday);
        setDataRevision((current) => current + 1);
        setLoadError(null);
        return true;
      } catch (error) {
        if (loadVersion.current !== activeVersion) return latestLoad.current ?? false;
        // Keep the last DB projection visible; never invent a local status after a write.
        setLoadError(getTodayErrorMessage(error));
        return false;
      } finally {
        if (loadVersion.current === activeVersion) setIsLoading(false);
      }
    })();
    latestLoad.current = operation;
    return operation;
  }, [repository]);

  useEffect(() => {
    let isActive = true;
    void Promise.resolve().then(() => {
      if (!isActive) return;
      setToday(null);
      if (!repository) {
        setLoadError('今日の予定を表示するにはログインが必要です。');
        setIsLoading(false);
      } else {
        void refresh();
      }
    });

    return () => {
      isActive = false;
      loadVersion.current += 1;
      latestLoad.current = null;
    };
  }, [refresh, refreshToken, repository]);

  const retry = useCallback(() => {
    void refresh();
  }, [refresh]);

  return { dataRevision, isLoading, loadError, refresh, retry, today };
}
