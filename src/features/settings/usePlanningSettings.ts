import { useCallback, useEffect, useRef, useState } from 'react';

import { getSettingsErrorMessage } from './errors';
import type {
  ProfilePlanningSettings,
  SettingsRepository,
  UpdateProfilePlanningSettingsInput,
} from './repositories/SettingsRepository';

export function usePlanningSettings(repository: SettingsRepository | null) {
  const [settings, setSettings] = useState<ProfilePlanningSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const saveLock = useRef(false);

  useEffect(() => {
    let isActive = true;

    if (!repository) {
      void Promise.resolve().then(() => {
        if (isActive) {
          setSettings(null);
          setLoadError('プロフィール設定を表示するにはログインが必要です。');
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
      .getProfilePlanningSettings()
      .then((loadedSettings) => {
        if (isActive) {
          setSettings(loadedSettings);
          setLoadError(null);
          setSaveError(null);
          setSaveSucceeded(false);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setSettings(null);
          setLoadError(getSettingsErrorMessage(error));
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

  const clearSaveFeedback = useCallback(() => {
    setSaveError(null);
    setSaveSucceeded(false);
  }, []);

  const save = useCallback(
    async (input: UpdateProfilePlanningSettingsInput): Promise<boolean> => {
      if (!repository || saveLock.current) return false;

      saveLock.current = true;
      setIsSaving(true);
      setSaveError(null);
      setSaveSucceeded(false);

      try {
        const updatedSettings = await repository.updateProfilePlanningSettings(input);
        setSettings(updatedSettings);
        setSaveSucceeded(true);
        return true;
      } catch (error) {
        setSaveError(getSettingsErrorMessage(error));
        return false;
      } finally {
        saveLock.current = false;
        setIsSaving(false);
      }
    },
    [repository],
  );

  return {
    clearSaveFeedback,
    isLoading,
    isSaving,
    loadError,
    retry,
    save,
    saveError,
    saveSucceeded,
    settings,
  };
}
