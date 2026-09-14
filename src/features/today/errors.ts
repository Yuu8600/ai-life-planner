type ErrorWithCode = {
  code?: unknown;
  message?: unknown;
};

export function getTodayErrorMessage(error: unknown): string {
  const candidate = error as ErrorWithCode;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';

  if (code === '42501') {
    return '今日の予定を表示する権限がありません。再度ログインしてください。';
  }

  if (code === 'INVALID_TIME_ZONE') {
    return 'タイムゾーン設定が正しくありません。設定を確認してください。';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return '今日の予定に接続できません。通信状況を確認して再度お試しください。';
  }

  return '今日の予定を読み込めませんでした。時間をおいて再度お試しください。';
}
