import { useCallback, useEffect, useRef, useState } from 'react';

import { useDeviceCalendar, type CalendarRepository } from '@/features/calendar';
import type { SettingsRepository } from '@/features/settings';

import type { PlannerValidationIssue } from './contracts';
import {
  generatePlannerPreview,
  PlannerPreviewCalendarPermissionError,
  PlannerPreviewProviderError,
  type PlannerPreviewData,
  type PlannerPreviewGoalRepository,
  type PlannerPreviewTaskRepository,
} from './plannerPreview';
import type { PlannerProvider } from './providers/PlannerProvider';

export type PlannerPreviewErrorKind = 'data' | 'permission' | 'provider' | 'validation';

export type PlannerPreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ status: 'success' } & PlannerPreviewData)
  | {
      issues: PlannerValidationIssue[];
      kind: PlannerPreviewErrorKind;
      message: string;
      status: 'error';
    };

type UsePlannerPreviewInput = {
  calendarRepository: CalendarRepository | null;
  goalRepository: PlannerPreviewGoalRepository | null;
  now?: () => Date;
  provider: PlannerProvider;
  refreshToken?: number;
  settingsRepository: SettingsRepository | null;
  taskRepository: PlannerPreviewTaskRepository | null;
};

const getCurrentDate = () => new Date();

export function usePlannerPreview({
  calendarRepository,
  goalRepository,
  now = getCurrentDate,
  provider,
  refreshToken = 0,
  settingsRepository,
  taskRepository,
}: UsePlannerPreviewInput) {
  const calendar = useDeviceCalendar(calendarRepository, settingsRepository, refreshToken, now);
  const [state, setState] = useState<PlannerPreviewState>({ status: 'idle' });
  const generationLock = useRef(false);
  const generationVersion = useRef(0);

  useEffect(() => {
    let isActive = true;
    generationVersion.current += 1;
    generationLock.current = false;
    void Promise.resolve().then(() => {
      if (isActive) setState({ status: 'idle' });
    });

    return () => {
      isActive = false;
    };
  }, [
    calendarRepository,
    goalRepository,
    provider,
    refreshToken,
    settingsRepository,
    taskRepository,
  ]);

  const generate = useCallback(async () => {
    if (generationLock.current) return;

    if (!calendarRepository || !goalRepository || !settingsRepository || !taskRepository) {
      setState({
        issues: [],
        kind: 'data',
        message: '計画を作成するにはログインが必要です。',
        status: 'error',
      });
      return;
    }

    generationLock.current = true;
    const activeVersion = generationVersion.current + 1;
    generationVersion.current = activeVersion;
    setState({ status: 'loading' });

    try {
      const result = await generatePlannerPreview({
        calendarRepository,
        goalRepository,
        now,
        provider,
        settingsRepository,
        taskRepository,
      });

      if (generationVersion.current !== activeVersion) return;

      if (!result.ok) {
        setState({
          issues: result.issues,
          kind: 'validation',
          message: '計画を生成できませんでした。生成結果を確認してください。',
          status: 'error',
        });
        return;
      }

      setState({
        input: result.input,
        proposal: result.proposal,
        status: 'success',
        timezone: result.timezone,
        warnings: result.warnings,
      });
    } catch (error) {
      if (generationVersion.current !== activeVersion) return;

      if (error instanceof PlannerPreviewCalendarPermissionError) {
        setState({
          issues: [],
          kind: 'permission',
          message: 'カレンダーのアクセス許可を確認して、もう一度お試しください。',
          status: 'error',
        });
      } else if (error instanceof PlannerPreviewProviderError) {
        setState({
          issues: [],
          kind: 'provider',
          message: '計画を生成できませんでした。Plannerの実行中に問題が発生しました。',
          status: 'error',
        });
      } else {
        setState({
          issues: [],
          kind: 'data',
          message: '計画に必要なデータを読み込めませんでした。もう一度お試しください。',
          status: 'error',
        });
      }
    } finally {
      if (generationVersion.current === activeVersion) generationLock.current = false;
    }
  }, [calendarRepository, goalRepository, now, provider, settingsRepository, taskRepository]);

  const discard = useCallback(() => {
    generationVersion.current += 1;
    generationLock.current = false;
    setState({ status: 'idle' });
  }, []);
  const hasRepositories = Boolean(
    calendarRepository && goalRepository && settingsRepository && taskRepository,
  );
  const canGenerate =
    hasRepositories &&
    calendar.accessState === 'granted' &&
    !calendar.isLoadingEvents &&
    calendar.calendarCount !== null &&
    !calendar.loadError &&
    state.status !== 'loading';

  return {
    calendar,
    canGenerate,
    discard,
    generate,
    state,
  };
}
