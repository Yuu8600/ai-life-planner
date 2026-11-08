import { FormField, FormInput } from '@/shared/components/FormField';
import { Notice } from '@/shared/components/Notice';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AuthCredentials, SignUpResult } from '@/services/supabase/auth';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { colors, radius, spacing, typography } from '@/shared/theme';

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
              ? '目標・タスクとカレンダーの空き時間から、今日の計画を作成します。'
              : '目標をタスクに分け、予定の合間に取り組める一日へ。'}
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
          <FormField label="メールアドレス">
            <FormInput
              accessibilityLabel="メールアドレス"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!isSubmitting}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="name@example.com"
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
            />
          </FormField>

          <FormField label="パスワード">
            <FormInput
              accessibilityLabel="パスワード"
              autoCapitalize="none"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              editable={!isSubmitting}
              onChangeText={setPassword}
              onSubmitEditing={() => void submit()}
              placeholder={isLogin ? 'パスワードを入力' : '6文字以上で入力'}
              returnKeyType="done"
              secureTextEntry
              textContentType={isLogin ? 'password' : 'newPassword'}
              value={password}
            />
          </FormField>

          {displayedError ? <Notice tone="error" message={displayedError} /> : null}

          {successMessage ? <Notice tone="success" message={successMessage} /> : null}

          <ActionButton
            accessibilityLabel={isSubmitting ? loadingLabel : `${submitLabel}する`}
            disabled={isSubmitting}
            loading={isSubmitting}
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
    ...typography.screenTitle,
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
    minHeight: 48,
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
