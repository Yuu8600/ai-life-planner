import { ProfileNotFoundError } from '@/features/settings';
import { PlanConflictError } from './repository';

type ProviderError = { code?: unknown; message?: unknown };

export class PlanningRequestError extends Error {
  constructor(
    readonly operation: string,
    cause: unknown,
  ) {
    super('Planning request failed', { cause });
  }
}

function diagnose(error: unknown) {
  if (error instanceof PlanConflictError) {
    return { code: 'PLAN_CONFLICT', reason: 'Plan changed', guidance: error.message };
  }
  if (error instanceof ProfileNotFoundError) {
    return {
      code: 'PROFILE_MISSING',
      reason: 'Profile missing',
      guidance: 'プロフィールが見つかりません。ログインし直してください。',
    };
  }

  const candidate = error as ProviderError | null;
  const code =
    typeof candidate?.code === 'string' && /^(?:PGRST\d{3}|[\dA-Z]{5})$/.test(candidate.code)
      ? candidate.code
      : undefined;
  const message = typeof candidate?.message === 'string' ? candidate.message : '';

  if (code === 'PGRST303' && message === 'JWT issued at future') {
    return {
      code,
      reason: 'JWT issued at future',
      guidance: '認証の準備が完了していません。少し待ってから再読み込みしてください。',
    };
  }
  if (['PGRST202', 'PGRST204', 'PGRST205', '42883', '42P01', '42703'].includes(code ?? '')) {
    return {
      code,
      reason: 'Required database schema or RPC unavailable',
      guidance:
        'V2の計画データにアクセスできません。アプリの接続先とV2のDB設定を確認してください。',
    };
  }
  if (['PGRST301', 'PGRST302', 'PGRST303', '42501', '28P01'].includes(code ?? '')) {
    return {
      code,
      reason: 'Authentication or permission failed',
      guidance: '計画データにアクセスする権限を確認できません。ログインし直してください。',
    };
  }
  if (
    /^(?:(?:TypeError|Error): )?(?:Network request failed|Failed to fetch|fetch failed)$/i.test(
      message,
    )
  ) {
    return {
      code,
      reason: 'Network request failed',
      guidance: '計画のサーバーに接続できません。接続先と通信状況を確認してください。',
    };
  }
  if (
    message === '保存済み計画の形式を読み取れません。' ||
    message === 'タスクの形式を読み取れません。'
  ) {
    return { code, reason: 'Unexpected stored planning data', guidance: message };
  }
  return { code, reason: 'Unclassified error', guidance: undefined };
}

export function reportPlanningIssue(operation: string, error: unknown): string | undefined {
  const failed = error instanceof PlanningRequestError ? error : undefined;
  const { code, reason, guidance } = diagnose(failed ? failed.cause : error);
  // Provider messages may include tokens, URLs, or record contents. Log only known descriptions.
  console.warn('[V2 planning]', { operation: failed?.operation ?? operation, code, reason });
  return guidance;
}
