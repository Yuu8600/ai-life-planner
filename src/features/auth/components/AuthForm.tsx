import { Card } from '@/shared/components/Card';
import { FormField, FormInput } from '@/shared/components/FormField';
import { Notice } from '@/shared/components/Notice';
import { useRef, useState, type RefObject } from 'react';
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
  const passwordInput = useRef<TextInput>(null);
  const loginTab = useRef<View>(null),
    signupTab = useRef<View>(null);
  const navigateMode = (key: string) => {
    if (isSubmitting || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
    const next = key === 'Home' ? 'login' : key === 'End' ? 'signup' : isLogin ? 'signup' : 'login';
    changeMode(next);
    requestAnimationFrame(() => (next === 'login' ? loginTab : signupTab).current?.focus());
  };

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
          <Text accessibilityRole="header" style={styles.title}>
            AI Life Planner
          </Text>
          <Text style={styles.subtitle}>予定の合間に、目標を進める。</Text>
        </View>

        <Card>
          <View
            accessibilityRole="tablist"
            accessibilityLabel="ログインと新規登録"
            style={styles.modeSwitch}
          >
            <ModeButton
              disabled={isSubmitting}
              label="ログイン"
              id="auth-login-tab"
              buttonRef={loginTab}
              onNavigate={navigateMode}
              onPress={() => changeMode('login')}
              selected={isLogin}
            />
            <ModeButton
              disabled={isSubmitting}
              label="新規登録"
              id="auth-signup-tab"
              buttonRef={signupTab}
              onNavigate={navigateMode}
              onPress={() => changeMode('signup')}
              selected={!isLogin}
            />
          </View>

          <View
            style={styles.form}
            {...(Platform.OS === 'web'
              ? {
                  role: 'tabpanel' as const,
                  id: 'auth-fields',
                  'aria-labelledby': isLogin ? 'auth-login-tab' : 'auth-signup-tab',
                }
              : {})}
          >
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
                onSubmitEditing={() => passwordInput.current?.focus()}
                textContentType="emailAddress"
                value={email}
              />
            </FormField>

            <FormField label="パスワード">
              <FormInput
                accessibilityLabel="パスワード"
                ref={passwordInput}
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

            <ActionButton
              accessibilityLabel={isSubmitting ? loadingLabel : `${submitLabel}する`}
              disabled={isSubmitting}
              loading={isSubmitting}
              label={isSubmitting ? loadingLabel : submitLabel}
              onPress={() => void submit()}
              style={styles.submitButton}
            />
            {displayedError ? <Notice tone="error" message={displayedError} /> : null}

            {successMessage ? <Notice tone="success" message={successMessage} /> : null}
          </View>
        </Card>
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
  id: string;
  buttonRef: RefObject<View | null>;
  onNavigate: (key: string) => void;
  disabled: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
};

function ModeButton({
  disabled,
  label,
  onPress,
  selected,
  id,
  buttonRef,
  onNavigate,
}: ModeButtonProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={buttonRef}
      nativeID={id}
      {...(Platform.OS === 'web'
        ? {
            'aria-selected': selected,
            'aria-controls': 'auth-fields',
            tabIndex: selected ? 0 : -1,
            onKeyDown: (event: { key: string; preventDefault: () => void }) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                onNavigate(event.key);
              }
            },
          }
        : {})}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityLabel={`${label}に切り替える`}
      accessibilityRole="tab"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.modeButton,
        selected ? styles.selectedModeButton : null,
        focused
          ? Platform.select({
              web: {
                outlineColor: colors.focusRing,
                outlineWidth: 2,
                outlineStyle: 'solid',
                outlineOffset: 2,
              },
              default: { borderColor: colors.focusRing, borderWidth: 2 },
            })
          : null,
      ]}
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
    justifyContent: 'flex-start',
    gap: spacing.lg,
    paddingTop: spacing.xl,
  },
  intro: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    ...typography.screenTitle,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    ...typography.body,
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 0,
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
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedModeButton: {
    backgroundColor: colors.accentSoft,
  },
  modeLabel: {
    color: colors.textMuted,
    ...typography.button,
  },
  selectedModeLabel: {
    color: colors.accent,
  },
  form: {
    gap: spacing.lg,
    marginTop: 0,
  },
  submitButton: {
    minHeight: 50,
    marginTop: spacing.xs,
  },
  footnote: {
    marginTop: 0,
    color: colors.textSubtle,
    ...typography.secondary,
    textAlign: 'center',
  },
});
