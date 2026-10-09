import { useCallback, useEffect, useRef, useState } from 'react';

import { executePlannedAction } from './plannedActionExecution';
import type {
  ActionExecutionStatus,
  PlannedActionExecutionRepository,
} from './repositories/PlannedActionExecutionRepository';
import type { TodayPlannedAction } from './repositories/TodayRepository';

export type ActionMutationState = { status: 'updating' } | { message: string; status: 'error' };

export function usePlannedActionExecution(
  repository: PlannedActionExecutionRepository | null,
  refresh: () => Promise<boolean>,
) {
  const [mutations, setMutations] = useState<Record<string, ActionMutationState>>({});
  const locks = useRef(new Set<string>());
  const version = useRef(0);

  useEffect(() => {
    let active = true;
    version.current += 1;
    locks.current.clear();
    void Promise.resolve().then(() => {
      if (active) setMutations({});
    });
    return () => {
      active = false;
      version.current += 1;
    };
  }, [repository, refresh]);

  const execute = useCallback(
    async (action: TodayPlannedAction, targetStatus: ActionExecutionStatus) => {
      if (!repository || locks.current.has(action.id)) return;
      const activeVersion = version.current;
      locks.current.add(action.id);
      setMutations((current) => ({ ...current, [action.id]: { status: 'updating' } }));
      try {
        await executePlannedAction(repository, action, targetStatus);
        if (version.current !== activeVersion) return;
        const refreshed = await refresh();
        if (version.current !== activeVersion) return;
        setMutations((current) => {
          const next = { ...current };
          if (refreshed) delete next[action.id];
          else
            next[action.id] = {
              message:
                '更新は保存されましたが、最新の予定を取得できませんでした。再読み込みしてください。',
              status: 'error',
            };
          return next;
        });
      } catch {
        if (version.current !== activeVersion) return;
        setMutations((current) => ({
          ...current,
          [action.id]: {
            message:
              targetStatus === 'completed'
                ? '完了処理に失敗しました。もう一度お試しください。'
                : 'スキップ処理に失敗しました。もう一度お試しください。',
            status: 'error',
          },
        }));
      } finally {
        if (version.current === activeVersion) locks.current.delete(action.id);
      }
    },
    [refresh, repository],
  );

  return { execute, mutations };
}
