export function getAuthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('invalid login credentials')) {
    return 'メールアドレスまたはパスワードが正しくありません。';
  }

  if (message.includes('email not confirmed')) {
    return 'メールアドレスの確認が完了していません。確認メールをご確認ください。';
  }

  if (message.includes('user already registered')) {
    return 'このメールアドレスはすでに登録されています。';
  }

  if (message.includes('password') && (message.includes('weak') || message.includes('least'))) {
    return 'パスワードが要件を満たしていません。より長いパスワードを設定してください。';
  }

  if (message.includes('signup') && message.includes('disabled')) {
    return '現在、新規登録を利用できません。';
  }

  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'リクエストが多すぎます。しばらく待ってからもう一度お試しください。';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return '認証サービスに接続できません。通信状況を確認してください。';
  }

  if (message.includes('supabase環境変数') || message.includes('expo_public_supabase')) {
    return 'Supabaseの接続設定を確認してください。';
  }

  return '認証に失敗しました。時間をおいてもう一度お試しください。';
}
