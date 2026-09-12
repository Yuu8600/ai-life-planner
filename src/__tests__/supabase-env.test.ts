import { SupabaseEnvironmentError, validateSupabaseEnvironment } from '@/services/supabase/env';

describe('validateSupabaseEnvironment', () => {
  it('returns trimmed public configuration', () => {
    expect(
      validateSupabaseEnvironment({
        publishableKey: '  sb_publishable_example  ',
        url: '  https://example.supabase.co  ',
      }),
    ).toEqual({
      publishableKey: 'sb_publishable_example',
      url: 'https://example.supabase.co',
    });
  });

  it('reports missing variable names without exposing values', () => {
    expect(() => validateSupabaseEnvironment({})).toThrow(
      new SupabaseEnvironmentError(
        'Supabase環境変数が未設定です: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      ),
    );
  });

  it('rejects an invalid URL without including the publishable key', () => {
    const publishableKey = 'do-not-print-this-value';

    try {
      validateSupabaseEnvironment({ publishableKey, url: 'not-a-url' });
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(SupabaseEnvironmentError);
      expect((error as Error).message).toContain('EXPO_PUBLIC_SUPABASE_URL');
      expect((error as Error).message).not.toContain(publishableKey);
    }
  });
});
