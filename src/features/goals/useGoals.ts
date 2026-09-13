import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  CreateGoalInput,
  Goal,
  GoalRepository,
  UpdateGoalInput,
} from './repositories/GoalRepository';
import { getGoalErrorMessage } from './errors';

export type GoalMutation = 'create' | `delete:${string}` | `update:${string}`;

export function useGoals(repository: GoalRepository | null) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] = useState<GoalMutation | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const mutationLock = useRef(false);

  useEffect(() => {
    let isActive = true;

    if (!repository) {
      void Promise.resolve().then(() => {
        if (isActive) {
          setGoals([]);
          setLoadError('目標を表示するにはログインが必要です。');
          setIsLoading(false);
        }
      });

      return () => {
        isActive = false;
      };
    }

    void repository
      .list()
      .then((loadedGoals) => {
        if (isActive) {
          setGoals(loadedGoals);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setGoals([]);
          setLoadError(getGoalErrorMessage(error));
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [loadAttempt, repository]);

  const retry = useCallback(() => {
    if (!repository) return;
    setIsLoading(true);
    setLoadError(null);
    setLoadAttempt((current) => current + 1);
  }, [repository]);

  const runMutation = useCallback(
    async (
      mutation: GoalMutation,
      operation: (activeRepository: GoalRepository) => Promise<void>,
    ): Promise<boolean> => {
      if (!repository || mutationLock.current) return false;

      mutationLock.current = true;
      setMutationError(null);
      setPendingMutation(mutation);

      try {
        await operation(repository);
        return true;
      } catch (error) {
        setMutationError(getGoalErrorMessage(error));
        return false;
      } finally {
        mutationLock.current = false;
        setPendingMutation(null);
      }
    },
    [repository],
  );

  const createGoal = useCallback(
    (input: CreateGoalInput) =>
      runMutation('create', async (activeRepository) => {
        const createdGoal = await activeRepository.create(input);
        setGoals((current) => [createdGoal, ...current]);
      }),
    [runMutation],
  );

  const updateGoal = useCallback(
    (id: string, input: UpdateGoalInput) =>
      runMutation(`update:${id}`, async (activeRepository) => {
        const updatedGoal = await activeRepository.update(id, input);
        setGoals((current) =>
          current.map((goal) => (goal.id === updatedGoal.id ? updatedGoal : goal)),
        );
      }),
    [runMutation],
  );

  const deleteGoal = useCallback(
    (id: string) =>
      runMutation(`delete:${id}`, async (activeRepository) => {
        await activeRepository.remove(id);
        setGoals((current) => current.filter((goal) => goal.id !== id));
      }),
    [runMutation],
  );

  return {
    clearMutationError: () => setMutationError(null),
    createGoal,
    deleteGoal,
    goals,
    isLoading,
    loadError,
    mutationError,
    pendingMutation,
    retry,
    updateGoal,
  };
}
