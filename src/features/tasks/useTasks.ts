import { useCallback, useEffect, useRef, useState } from 'react';

import { getGoalOptionsErrorMessage, getTaskErrorMessage } from './errors';
import type {
  CreateTaskInput,
  Task,
  TaskGoalOption,
  TaskRepository,
  UpdateTaskInput,
} from './repositories/TaskRepository';

export type TaskMutation = 'create' | `delete:${string}` | `update:${string}`;

export function useTasks(repository: TaskRepository | null, refreshToken = 0) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goalOptions, setGoalOptions] = useState<TaskGoalOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGoalOptions, setIsLoadingGoalOptions] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [goalOptionsError, setGoalOptionsError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] = useState<TaskMutation | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [goalLoadAttempt, setGoalLoadAttempt] = useState(0);
  const mutationLock = useRef(false);

  useEffect(() => {
    let isActive = true;

    if (!repository) {
      void Promise.resolve().then(() => {
        if (isActive) {
          setTasks([]);
          setLoadError('タスクを表示するにはログインが必要です。');
          setIsLoading(false);
        }
      });

      return () => {
        isActive = false;
      };
    }

    void Promise.resolve().then(() => {
      if (isActive) setIsLoading(true);
    });

    void repository
      .list()
      .then((loadedTasks) => {
        if (isActive) {
          setTasks(loadedTasks);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setTasks([]);
          setLoadError(getTaskErrorMessage(error));
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [loadAttempt, refreshToken, repository]);

  useEffect(() => {
    let isActive = true;

    if (!repository) {
      void Promise.resolve().then(() => {
        if (isActive) {
          setGoalOptions([]);
          setGoalOptionsError(null);
          setIsLoadingGoalOptions(false);
        }
      });

      return () => {
        isActive = false;
      };
    }

    void Promise.resolve().then(() => {
      if (isActive) setIsLoadingGoalOptions(true);
    });

    void repository
      .listGoalOptions()
      .then((loadedGoals) => {
        if (isActive) {
          setGoalOptions(loadedGoals);
          setGoalOptionsError(null);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setGoalOptions([]);
          setGoalOptionsError(getGoalOptionsErrorMessage(error));
        }
      })
      .finally(() => {
        if (isActive) setIsLoadingGoalOptions(false);
      });

    return () => {
      isActive = false;
    };
  }, [goalLoadAttempt, refreshToken, repository]);

  const retry = useCallback(() => {
    if (!repository) return;
    setIsLoading(true);
    setLoadError(null);
    setLoadAttempt((current) => current + 1);
  }, [repository]);

  const retryGoalOptions = useCallback(() => {
    if (!repository) return;
    setIsLoadingGoalOptions(true);
    setGoalOptionsError(null);
    setGoalLoadAttempt((current) => current + 1);
  }, [repository]);

  const runMutation = useCallback(
    async (
      mutation: TaskMutation,
      operation: (activeRepository: TaskRepository) => Promise<void>,
    ): Promise<boolean> => {
      if (!repository || mutationLock.current) return false;

      mutationLock.current = true;
      setMutationError(null);
      setPendingMutation(mutation);

      try {
        await operation(repository);
        return true;
      } catch (error) {
        setMutationError(getTaskErrorMessage(error));
        return false;
      } finally {
        mutationLock.current = false;
        setPendingMutation(null);
      }
    },
    [repository],
  );

  const createTask = useCallback(
    (input: CreateTaskInput) =>
      runMutation('create', async (activeRepository) => {
        const createdTask = await activeRepository.create(input);
        setTasks((current) => [createdTask, ...current]);
      }),
    [runMutation],
  );

  const updateTask = useCallback(
    (id: string, input: UpdateTaskInput) =>
      runMutation(`update:${id}`, async (activeRepository) => {
        const updatedTask = await activeRepository.update(id, input);
        setTasks((current) =>
          current.map((task) => (task.id === updatedTask.id ? updatedTask : task)),
        );
      }),
    [runMutation],
  );

  const deleteTask = useCallback(
    (id: string) =>
      runMutation(`delete:${id}`, async (activeRepository) => {
        await activeRepository.remove(id);
        setTasks((current) => current.filter((task) => task.id !== id));
      }),
    [runMutation],
  );

  return {
    clearMutationError: () => setMutationError(null),
    createTask,
    deleteTask,
    goalOptions,
    goalOptionsError,
    isLoading,
    isLoadingGoalOptions,
    loadError,
    mutationError,
    pendingMutation,
    retry,
    retryGoalOptions,
    tasks,
    updateTask,
  };
}
