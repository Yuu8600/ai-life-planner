import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { AuthCredentials, SignUpResult } from '@/services/supabase/auth';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { colors, radius, spacing } from '@/shared/theme';

import { type AuthMode, validateAuthCredentials } from '../credentials';
import { getAuthErrorMessage } from '../errors';

type AuthFormProps = {
  onSignIn: (credentials: AuthCredentials) => Promise<void>;
  onSignUp: (credentials: AuthCredentials) => Promise<SignUpResult>;
  restorationError?: string | null;
};

const CONFIRMATION_MESSAGE =
  '確認メールを送信しました。メール内のリンクを開いてからログインしてください。';

export function AuthForm({ onSignIn, onSignUp, restorationError }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isLogin = mode === 'login';

  const changeMode = (nextMode: AuthMode) => {
    if (isSubmitting || nextMode === mode) return;

    setMode(nextMode);
    setPassword('');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const submit = async () => {
    if (isSubmitting) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const validation = validateAuthCredentials({ email, password }, mode);

    if (validation.credentials === null) {
      setErrorMessage(validation.error);
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        await onSignIn(validation.credentials);
      } else {
        const result = await onSignUp(validation.credentials);

        if (!result.session) {
          setPassword('');
          setSuccessMessage(CONFIRMATION_MESSAGE);
        }
      }
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitLabel = isLogin ? 'ログイン' : 'アカウントを作成';
  const loadingLabel = isLogin ? 'ログイン中…' : '登録中…';
  const displayedError = errorMessage ?? restorationError ?? null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <AppScreen contentContainerStyle={styles.content} testID="auth-screen">
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>AI LIFE PLANNER</Text>
          <Text style={styles.title}>{isLogin ? 'おかえりなさい' : 'はじめましょう'}</Text>
          <Text style={styles.subtitle}>
            {isLogin
              ? '今日の計画を確認するためにログインしてください。'
              : '目標と毎日の予定を、ひとつの場所で整えます。'}
          </Text>
        </View>

        <View accessibilityRole="tablist" style={styles.modeSwitch}>
          <ModeButton
            disabled={isSubmitting}
            label="ログイン"
            onPress={() => changeMode('login')}
            selected={isLogin}
          />
          <ModeButton
            disabled={isSubmitting}
            label="新規登録"
            onPress={() => changeMode('signup')}
            selected={!isLogin}
          />
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>メールアドレス</Text>
            <TextInput
              accessibilityLabel="メールアドレス"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!isSubmitting}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={colors.textSubtle}
              returnKeyType="next"
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>パスワード</Text>
            <TextInput
              accessibilityLabel="パスワード"
              autoCapitalize="none"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              editable={!isSubmitting}
              onChangeText={setPassword}
              onSubmitEditing={() => void submit()}
              placeholder={isLogin ? 'パスワードを入力' : '6文字以上で入力'}
              placeholderTextColor={colors.textSubtle}
              returnKeyType="done"
              secureTextEntry
              style={styles.input}
              textContentType={isLogin ? 'password' : 'newPassword'}
              value={password}
            />
          </View>

          {displayedError ? (
            <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
              {displayedError}
            </Text>
          ) : null}

          {successMessage ? (
            <Text accessibilityLiveRegion="polite" style={styles.success}>
              {successMessage}
            </Text>
          ) : null}

          <ActionButton
            accessibilityLabel={isSubmitting ? loadingLabel : `${submitLabel}する`}
            disabled={isSubmitting}
            label={isSubmitting ? loadingLabel : submitLabel}
            onPress={() => void submit()}
            style={styles.submitButton}
          />
        </View>

        <Text style={styles.footnote}>
          {isLogin
            ? '登録したメールアドレスとパスワードを使用します。'
            : 'メール確認が有効な場合は、登録後に確認メールをお送りします。'}
        </Text>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

type ModeButtonProps = {
  disabled: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
};

function ModeButton({ disabled, label, onPress, selected }: ModeButtonProps) {
  return (
    <Pressable
      accessibilityLabel={`${label}に切り替える`}
      accessibilityRole="tab"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.modeButton, selected ? styles.selectedModeButton : null]}
    >
      <Text style={[styles.modeLabel, selected ? styles.selectedModeLabel : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  intro: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xxl,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  modeButton: {
    minHeight: 42,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  selectedModeButton: {
    backgroundColor: colors.accentSoft,
  },
  modeLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedModeLabel: {
    color: colors.accent,
  },
  form: {
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
  },
  error: {
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    fontSize: 13,
    lineHeight: 19,
  },
  success: {
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    fontSize: 13,
    lineHeight: 19,
  },
  submitButton: {
    minHeight: 50,
    marginTop: spacing.xs,
  },
  footnote: {
    marginTop: spacing.xl,
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
