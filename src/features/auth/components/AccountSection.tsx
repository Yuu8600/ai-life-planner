import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { colors, radius, spacing } from '@/shared/theme';

import { getAuthErrorMessage } from '../errors';
import { useAuth } from '../AuthProvider';

export function AccountSection() {
  const { session, signOut } = useAuth();
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
    <View style={styles.section}>
      <SectionHeader title="アカウント" />
      <View style={styles.panel}>
        <Text style={styles.label}>ログイン中</Text>
        <Text
          accessibilityLabel={`ログイン中のメールアドレス ${session?.user.email ?? '不明'}`}
          style={styles.email}
        >
          {session?.user.email ?? '認証済みユーザー'}
        </Text>
        <Text style={styles.detail}>この端末に保存された認証セッションを終了します。</Text>
        {errorMessage ? (
          <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
            {errorMessage}
          </Text>
        ) : null}
        <ActionButton
          accessibilityLabel={isSigningOut ? 'ログアウト処理中' : 'ログアウトする'}
          disabled={isSigningOut}
          loading={isSigningOut}
          label={isSigningOut ? 'ログアウト中…' : 'ログアウト'}
          onPress={() => void handleSignOut()}
          variant="secondary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xl,
  },
  panel: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  email: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  detail: {
    marginBottom: spacing.sm,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
  },
});
