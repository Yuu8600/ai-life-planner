import type { AuthCredentials } from '@/services/supabase/auth';

export type AuthMode = 'login' | 'signup';

export type AuthCredentialsValidation =
  { credentials: AuthCredentials; error: null } | { credentials: null; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINIMUM_PASSWORD_LENGTH = 6;

export function validateAuthCredentials(
  values: AuthCredentials,
  mode: AuthMode,
): AuthCredentialsValidation {
  const email = values.email.trim();

  if (!email) {
    return { credentials: null, error: 'メールアドレスを入力してください。' };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { credentials: null, error: '有効なメールアドレスを入力してください。' };
  }

  if (!values.password) {
    return { credentials: null, error: 'パスワードを入力してください。' };
  }

  if (mode === 'signup' && values.password.length < MINIMUM_PASSWORD_LENGTH) {
    return {
      credentials: null,
      error: `パスワードは${MINIMUM_PASSWORD_LENGTH}文字以上で入力してください。`,
    };
  }

  return {
    credentials: { email, password: values.password },
    error: null,
  };
}
