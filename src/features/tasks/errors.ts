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

export class TaskCreateResultError extends Error {
  constructor(readonly result: 'saved' | 'unconfirmed') {
    super(result === 'saved' ? 'Saved task could not be read' : 'Task save could not be confirmed');
    this.name = 'TaskCreateResultError';
  }
}

export function getTaskErrorMessage(error: unknown): string {
  if (error instanceof TaskNotFoundError) {
    return '対象のタスクが見つかりません。画面を更新してください。';
  }

  if (error instanceof TaskCreateResultError) {
    return error.result === 'saved'
      ? 'タスクは保存されましたが、表示を更新できませんでした。タスク一覧を再読み込みしてください。'
      : 'タスクの保存結果を確認できませんでした。通信状況を確認し、一覧を再読み込みしてください。';
  }

  const candidate = error as ErrorWithCode;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';

  if (code === '23502' && message.includes('estimated_minutes')) {
    return '接続先のDBは所要時間の未設定に対応していません。V2.5用の接続先とマイグレーションを確認してください。';
  }

  if (code === '23503') {
    return '選択したGoalへ関連付けできません。Goalを再読み込みして選び直してください。';
  }

  if (code === '23514') {
    return '入力内容がタスクの登録条件を満たしていません。';
  }

  if (['PGRST301', 'PGRST302', 'PGRST303', '28P01'].includes(code)) {
    return '認証を確認できません。設定からログインし直してください。';
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
