export type SupabaseEnvironmentValues = {
  publishableKey?: string;
  url?: string;
};

export type SupabaseEnvironment = {
  publishableKey: string;
  url: string;
};

export class SupabaseEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseEnvironmentError';
  }
}

export function validateSupabaseEnvironment(
  values: SupabaseEnvironmentValues,
): SupabaseEnvironment {
  const url = values.url?.trim();
  const publishableKey = values.publishableKey?.trim();
  const missingVariables: string[] = [];

  if (!url) {
    missingVariables.push('EXPO_PUBLIC_SUPABASE_URL');
  }

  if (!publishableKey) {
    missingVariables.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  if (!url || !publishableKey) {
    throw new SupabaseEnvironmentError(
      `Supabase環境変数が未設定です: ${missingVariables.join(', ')}`,
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new SupabaseEnvironmentError('EXPO_PUBLIC_SUPABASE_URLには有効なURLを設定してください。');
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new SupabaseEnvironmentError(
      'EXPO_PUBLIC_SUPABASE_URLにはhttpまたはhttpsのURLを設定してください。',
    );
  }

  return { publishableKey, url };
}

export function getSupabaseEnvironment(): SupabaseEnvironment {
  return validateSupabaseEnvironment({
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  });
}
