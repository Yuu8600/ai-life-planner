import { Card } from '@/shared/components/Card';
import { Notice } from '@/shared/components/Notice';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/shared/components/ActionButton';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { colors, spacing, typography } from '@/shared/theme';
import { getAuthErrorMessage } from '../errors';
export function AccountPanel({ email, signOut }: { email?: string; signOut: () => Promise<void> }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setErrorMessage(null);
    setIsSigningOut(true);

    try {
      await signOut();
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View testID="account-panel" style={styles.section}>
      <SectionHeader compact title="アカウント" />
      <Card>
        <Text style={styles.label}>ログイン中</Text>
        <Text
          selectable
          accessibilityLabel={`ログイン中のメールアドレス ${email ?? '不明'}`}
          style={styles.email}
        >
          {email ?? '認証済みユーザー'}
        </Text>
        <Text style={styles.detail}>この端末に保存された認証セッションを終了します。</Text>
        {errorMessage ? <Notice tone="error" message={errorMessage} /> : null}
        <ActionButton
          accessibilityLabel={isSigningOut ? 'ログアウト処理中' : 'ログアウトする'}
          disabled={isSigningOut}
          loading={isSigningOut}
          label={isSigningOut ? 'ログアウト中…' : 'ログアウト'}
          onPress={() => void handleSignOut()}
          variant="secondary"
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, minWidth: 0, width: '100%', maxWidth: 720, alignSelf: 'center' },
  label: { color: colors.textSecondary, ...typography.secondary },
  email: {
    color: colors.textPrimary,
    ...typography.bodyStrong,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  detail: { color: colors.textSecondary, ...typography.secondary },
});
