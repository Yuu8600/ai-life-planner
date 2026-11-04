import { useCallback, useEffect, useRef, useState } from 'react';

import { useDeviceCalendar, type CalendarRepository } from '@/features/calendar';
import type { SettingsRepository } from '@/features/settings';

import type { PlannerValidationIssue } from './contracts';
import {
  approvePlannerProposal,
  PlannerApprovalCheckError,
  PlannerPreviewStaleError,
} from './plannerPersistence';
import {
  generatePlannerPreview,
  PlannerPreviewCalendarPermissionError,
  PlannerPreviewProviderError,
  type PlannerPreviewData,
  type PlannerPreviewGoalRepository,
  type PlannerPreviewTaskRepository,
} from './plannerPreview';
import type { PlannerProvider } from './providers/PlannerProvider';
import type { PlannerReplanRepository } from './repositories/PlannerReplanRepository';
import type {
  PlannerPersistenceRepository,
  SavedDailyPlan,
} from './repositories/PlannerPersistenceRepository';

export type PlannerPreviewErrorKind = 'data' | 'permission' | 'provider' | 'validation';

export type PlannerPreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ providerId: string; status: 'success' } & PlannerPreviewData)
  | {
      issues: PlannerValidationIssue[];
      kind: PlannerPreviewErrorKind;
      message: string;
      status: 'error';
    };

export type PlannerSaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { plan: SavedDailyPlan; status: 'success' }
  | { issues: PlannerValidationIssue[]; message: string; status: 'stale' }
  | { kind: 'verification' | 'persistence'; message: string; status: 'error' };

type UsePlannerPreviewInput = {
  mode?: 'generate' | 'replan';
  replanRepository?: PlannerReplanRepository | null;
  onSaved?: () => void;
  calendarRepository: CalendarRepository | null;
  goalRepository: PlannerPreviewGoalRepository | null;
  now?: () => Date;
  persistenceRepository: PlannerPersistenceRepository | null;
  provider: PlannerProvider;
  refreshToken?: number;
  settingsRepository: SettingsRepository | null;
  taskRepository: PlannerPreviewTaskRepository | null;
};

const getCurrentDate = () => new Date();

export function usePlannerPreview({
  mode = 'generate',
  replanRepository = null,
  onSaved,
  calendarRepository,
  goalRepository,
  now = getCurrentDate,
  persistenceRepository,
  provider,
  refreshToken = 0,
  settingsRepository,
  taskRepository,
}: UsePlannerPreviewInput) {
  const calendar = useDeviceCalendar(calendarRepository, settingsRepository, refreshToken, now);
  const [state, setState] = useState<PlannerPreviewState>({ status: 'idle' });
  const [saveState, setSaveState] = useState<PlannerSaveState>({ status: 'idle' });
  const generationLock = useRef(false);
  const generationVersion = useRef(0);
  const saveLock = useRef(false);
  const saveVersion = useRef(0);
  const activePreview = useRef<PlannerPreviewState | null>(null);
  const approvalBlocked = useRef(false);

  useEffect(() => {
    let isActive = true;
    generationVersion.current += 1;
    saveVersion.current += 1;
    generationLock.current = false;
    saveLock.current = false;
    activePreview.current = null;
    approvalBlocked.current = false;
    void Promise.resolve().then(() => {
      if (isActive) {
        setState({ status: 'idle' });
        setSaveState({ status: 'idle' });
      }
    });

    return () => {
      isActive = false;
      generationVersion.current += 1;
      saveVersion.current += 1;
      activePreview.current = null;
    };
  }, [
    calendarRepository,
    goalRepository,
    persistenceRepository,
    provider,
    replanRepository,
    mode,
    settingsRepository,
    taskRepository,
  ]);

  useEffect(() => {
    if (saveLock.current) return;

    let isActive = true;
    generationVersion.current += 1;
    saveVersion.current += 1;
    generationLock.current = false;
    void Promise.resolve().then(() => {
      if (isActive) {
        // Reopening the app refreshes Calendar data; approval revalidates the retained Preview.
        setState((current) => (current.status === 'success' ? current : { status: 'idle' }));
      }
    });

    return () => {
      isActive = false;
    };
  }, [refreshToken]);

  const generate = useCallback(async () => {
    if (generationLock.current || saveLock.current) return;

    if (
      !calendarRepository ||
      !goalRepository ||
      !settingsRepository ||
      !taskRepository ||
      (mode === 'replan' && !replanRepository)
    ) {
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
    saveVersion.current += 1;
    setSaveState({ status: 'idle' });
    activePreview.current = null;
    approvalBlocked.current = false;
    setState({ status: 'loading' });

    try {
      const result = await generatePlannerPreview({
        calendarRepository,
        goalRepository,
        now,
        provider,
        replanRepository: mode === 'replan' ? (replanRepository ?? undefined) : undefined,
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

      const previewState: PlannerPreviewState = {
        expectedPlan: result.expectedPlan,
        input: result.input,
        proposal: result.proposal,
        providerId: provider.id,
        status: 'success',
        timezone: result.timezone,
        warnings: result.warnings,
      };
      activePreview.current = previewState;
      setState(previewState);
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
  }, [
    calendarRepository,
    goalRepository,
    now,
    provider,
    settingsRepository,
    taskRepository,
    mode,
    replanRepository,
  ]);

  const discard = useCallback(() => {
    if (saveLock.current) return;

    generationVersion.current += 1;
    saveVersion.current += 1;
    generationLock.current = false;
    activePreview.current = null;
    approvalBlocked.current = false;
    setState({ status: 'idle' });
    setSaveState({ status: 'idle' });
  }, []);
  const approve = useCallback(async () => {
    if (
      saveLock.current ||
      state.status !== 'success' ||
      activePreview.current !== state ||
      approvalBlocked.current ||
      state.providerId !== provider.id ||
      (mode === 'replan' && !state.expectedPlan)
    )
      return;

    if (
      !persistenceRepository ||
      !calendarRepository ||
      !goalRepository ||
      !settingsRepository ||
      !taskRepository
    ) {
      setSaveState({
        kind: 'verification',
        message: '計画を保存するにはログインが必要です。',
        status: 'error',
      });
      return;
    }

    saveLock.current = true;
    const activeVersion = saveVersion.current + 1;
    saveVersion.current = activeVersion;
    setSaveState({ status: 'saving' });

    try {
      const plan = await approvePlannerProposal(
        persistenceRepository,
        state,
        { calendarRepository, goalRepository, now, settingsRepository, taskRepository },
        () => saveVersion.current === activeVersion && activePreview.current === state,
        replanRepository ?? undefined,
      );

      if (saveVersion.current === activeVersion) {
        approvalBlocked.current = true;
        setSaveState({ plan, status: 'success' });
        onSaved?.();
      }
    } catch (error) {
      if (saveVersion.current === activeVersion) {
        if (error instanceof PlannerPreviewStaleError) {
          approvalBlocked.current = true;
          setSaveState({
            issues: error.issues,
            message: '状況が変わったため、計画を再生成してください。',
            status: 'stale',
          });
        } else {
          const verificationFailed = error instanceof PlannerApprovalCheckError;
          setSaveState({
            kind: verificationFailed ? 'verification' : 'persistence',
            message: verificationFailed
              ? '最新の状況を確認できませんでした。プレビューを保持したまま再試行できます。'
              : '計画を保存できませんでした。プレビューを保持したまま再試行できます。',
            status: 'error',
          });
        }
      }
    } finally {
      if (saveVersion.current === activeVersion) saveLock.current = false;
    }
  }, [
    calendarRepository,
    goalRepository,
    now,
    persistenceRepository,
    provider.id,
    settingsRepository,
    state,
    mode,
    replanRepository,
    onSaved,
    taskRepository,
  ]);
  const hasRepositories = Boolean(
    calendarRepository && goalRepository && settingsRepository && taskRepository,
  );
  const canGenerate =
    hasRepositories &&
    (mode !== 'replan' || replanRepository !== null) &&
    (state.status === 'success' ||
      (calendar.accessState === 'granted' &&
        !calendar.isLoadingEvents &&
        calendar.calendarCount !== null &&
        !calendar.loadError)) &&
    state.status !== 'loading' &&
    saveState.status !== 'saving';
  const canApprove =
    persistenceRepository !== null &&
    hasRepositories &&
    state.status === 'success' &&
    (mode !== 'replan' || Boolean(state.expectedPlan)) &&
    state.providerId === provider.id &&
    saveState.status !== 'saving' &&
    saveState.status !== 'stale' &&
    saveState.status !== 'success';

  return {
    approve,
    calendar,
    canApprove,
    canGenerate,
    discard,
    generate,
    saveState,
    state,
  };
}
