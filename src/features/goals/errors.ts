type ErrorWithCode = {
  code?: unknown;
  message?: unknown;
};

export class GoalNotFoundError extends Error {
  constructor() {
    super('Goal not found');
    this.name = 'GoalNotFoundError';
  }
}

export function getGoalErrorMessage(error: unknown): string {
  if (error instanceof GoalNotFoundError) {
    return '対象の目標が見つかりません。画面を更新してください。';
  }

  const candidate = error as ErrorWithCode;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';

  if (code === '23514') {
    return '入力内容が目標の登録条件を満たしていません。';
  }

  if (code === '42501') {
    return 'この目標を操作する権限がありません。再度ログインしてください。';
  }

  if (code === 'PGRST116') {
    return '対象の目標が見つかりません。画面を更新してください。';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return '目標データに接続できません。通信状況を確認して再度お試しください。';
  }

  return '目標データを処理できませんでした。時間をおいて再度お試しください。';
}
