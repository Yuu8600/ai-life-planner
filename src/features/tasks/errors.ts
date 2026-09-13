type ErrorWithCode = {
  code?: unknown;
  message?: unknown;
};

export class TaskNotFoundError extends Error {
  constructor() {
    super('Task not found');
    this.name = 'TaskNotFoundError';
  }
}

export function getTaskErrorMessage(error: unknown): string {
  if (error instanceof TaskNotFoundError) {
    return '対象のタスクが見つかりません。画面を更新してください。';
  }

  const candidate = error as ErrorWithCode;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';

  if (code === '23503') {
    return '選択したGoalへ関連付けできません。Goalを再読み込みして選び直してください。';
  }

  if (code === '23514') {
    return '入力内容がタスクの登録条件を満たしていません。';
  }

  if (code === '42501') {
    return 'このタスクを操作する権限がありません。再度ログインしてください。';
  }

  if (code === 'PGRST116') {
    return '対象のタスクが見つかりません。画面を更新してください。';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'タスクデータに接続できません。通信状況を確認して再度お試しください。';
  }

  return 'タスクデータを処理できませんでした。時間をおいて再度お試しください。';
}

export function getGoalOptionsErrorMessage(error: unknown): string {
  const candidate = error as ErrorWithCode;
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';

  if (message.includes('network') || message.includes('fetch')) {
    return 'Goal候補に接続できません。「Goalなし」のタスクは引き続き操作できます。';
  }

  return 'Goal候補を読み込めませんでした。「Goalなし」のタスクは引き続き操作できます。';
}
