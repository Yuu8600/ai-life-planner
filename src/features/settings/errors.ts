type ErrorWithCode = {
  code?: unknown;
  message?: unknown;
};

export class ProfileNotFoundError extends Error {
  constructor() {
    super('Profile not found');
    this.name = 'ProfileNotFoundError';
  }
}

export function getSettingsErrorMessage(error: unknown): string {
  if (error instanceof ProfileNotFoundError) {
    return 'プロフィール設定が見つかりません。再度ログインしてください。';
  }

  const candidate = error as ErrorWithCode;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';

  if (code === '23514' || code === '22003' || code === '22007' || code === '22008') {
    return '入力内容がプロフィールの設定条件を満たしていません。';
  }

  if (code === '42501') {
    return 'プロフィール設定を操作する権限がありません。再度ログインしてください。';
  }

  if (code === 'PGRST116') {
    return 'プロフィール設定が見つかりません。再度ログインしてください。';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'プロフィール設定に接続できません。通信状況を確認して再度お試しください。';
  }

  return 'プロフィール設定を処理できませんでした。時間をおいて再度お試しください。';
}
