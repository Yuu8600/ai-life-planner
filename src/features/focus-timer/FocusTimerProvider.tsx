import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Keyboard, Platform, Pressable, Text, View } from 'react-native';
import { ScreenHeaderAccessoryProvider } from '@/shared/components/ScreenHeaderAccessory';
import { ActionButton } from '@/shared/components/ActionButton';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { appAlert } from '@/shared/feedback/appAlert';
import { confirmDiscardChanges } from '@/shared/feedback/confirmDiscardChanges';
import { useTheme } from '@/shared/theme';
import {
  defaultTimerMinutes,
  formatRemaining,
  pauseTimer,
  remainingAt,
  resumeTimer,
  startTimer,
  type FocusTimer,
  type TimerTarget,
} from './timer';

const Context = createContext<{ open: (target: TimerTarget) => void } | null>(null);
export const useFocusTimer = () => useContext(Context);

/** Session-memory only. No repository, notifications or background worker. */
export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const { colors, spacing, typography, controls } = useTheme();
  const [timer, setTimer] = useState<FocusTimer | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [minutes, setMinutes] = useState('25');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const [active, setActive] = useState(AppState.currentState !== 'background');
  const remaining = timer ? remainingAt(timer, now) : 0;
  const finished = !!timer && timer.phase !== 'ready' && remaining === 0;
  const ticking = timer?.phase === 'running' && !finished;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      setNow(Date.now());
    });
    return () => sub?.remove();
  }, []);
  useEffect(() => {
    if (!ticking || !active) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [ticking, active]);
  const defaultMinutes = defaultTimerMinutes(timer?.target.initialMinutes);
  const open = useCallback(
    (target: TimerTarget) => {
      const select = () => {
        const preset = defaultTimerMinutes(target.initialMinutes);
        setTimer({
          target,
          phase: 'ready',
          remainingMs: Number(preset) * 60_000,
          deadlineMs: null,
        });
        setMinutes(preset);
        setError('');
        setNow(Date.now());
        setDismissed(false);
        setVisible(true);
      };
      if (timer?.target.id === target.id && timer.target.kind === target.kind) {
        setNow(Date.now());
        setDismissed(false);
        setVisible(true);
        return;
      }
      if (timer && timer.phase !== 'ready' && remainingAt(timer, Date.now()) > 0) {
        appAlert.alert(
          '別の作業へ切り替えますか？',
          '現在のタイマーを終了して切り替えます。タスクの完了状態や実績は変わりません。',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '切り替える', onPress: select },
          ],
        );
      } else
        confirmDiscardChanges(
          !!timer && timer.phase === 'ready' && minutes !== defaultMinutes,
          select,
        );
    },
    [timer, minutes, defaultMinutes],
  );
  const value = useMemo(() => ({ open }), [open]);
  const close = () => {
    setVisible(false);
    if (timer?.phase === 'ready' || finished) {
      setTimer(null);
      setMinutes('25');
      setError('');
    }
  };
  const end = () =>
    appAlert.alert('タイマーを終了しますか？', 'タスクの完了状態や作業実績は変更しません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '終了',
        onPress: () => {
          setTimer(null);
          setVisible(false);
          setError('');
        },
      },
    ]);
  // Only iOS page sheets report onDismiss; other platforms can reveal the header immediately.
  const bar = !!timer && !visible && (Platform.OS !== 'ios' || dismissed);
  return (
    <Context.Provider value={value}>
      <ScreenHeaderAccessoryProvider
        value={
          bar ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`作業タイマーを開く、${timer.target.title}、${finished ? '時間になりました' : timer.phase === 'paused' ? '一時停止中' : '残り'} ${formatRemaining(remaining)}`}
              onPress={() => {
                setNow(Date.now());
                setDismissed(false);
                setVisible(true);
              }}
              style={{
                minHeight: controls.minimumTarget,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.sm,
                paddingBottom: spacing.sm,
                backgroundColor: colors.primarySoft,
                borderTopWidth: 1,
                borderColor: colors.borderSubtle,
              }}
            >
              <Text numberOfLines={1} style={{ ...typography.label, color: colors.textPrimary }}>
                {timer.target.title}
              </Text>
              <Text style={{ ...typography.bodyStrong, color: colors.primary }}>
                {finished ? '時間になりました' : timer.phase === 'paused' ? '一時停止中' : '残り'}{' '}
                {formatRemaining(remaining)}　›
              </Text>
            </Pressable>
          ) : null
        }
      >
        {children}
      </ScreenHeaderAccessoryProvider>
      {timer ? (
        <ModalFrame
          title="作業タイマー"
          testID="focus-timer-modal"
          visible={visible}
          onDismiss={() => setDismissed(true)}
          onClose={close}
          dirty={timer.phase === 'ready' && minutes !== defaultMinutes}
          footer={
            timer.phase === 'ready' ? (
              <ActionButton
                label="開始"
                onPress={() => {
                  try {
                    Keyboard.dismiss();
                    const time = Date.now();
                    setTimer(startTimer(timer.target, minutes, time));
                    setNow(time);
                    setError('');
                  } catch (e) {
                    setError(e instanceof Error ? e.message : '時間を確認してください。');
                  }
                }}
              />
            ) : finished ? (
              <ActionButton label="閉じる" onPress={close} />
            ) : (
              <View style={{ gap: spacing.sm }}>
                <ActionButton
                  label={timer.phase === 'running' ? '一時停止' : '再開'}
                  onPress={() => {
                    Keyboard.dismiss();
                    const time = Date.now();
                    setTimer(
                      timer.phase === 'running'
                        ? pauseTimer(timer, time)
                        : resumeTimer(timer, time),
                    );
                    setNow(time);
                  }}
                />
                <ActionButton label="終了" variant="secondary" onPress={end} />
              </View>
            )
          }
        >
          <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>
            {timer.target.kind === 'step' ? '小さな行動' : 'タスク'}：{timer.target.title}
          </Text>
          {timer.phase === 'ready' ? (
            <>
              <FormField label="作業時間（分）" error={error}>
                <FormInput
                  accessibilityLabel="タイマーの作業時間"
                  value={minutes}
                  keyboardType="number-pad"
                  maxLength={3}
                  onChangeText={(v) => {
                    setMinutes(v);
                    setError('');
                  }}
                />
              </FormField>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {[5, 15, 25, 50].map((n) => (
                  <ActionButton
                    key={n}
                    label={`${n}分`}
                    variant={minutes === String(n) ? 'primary' : 'secondary'}
                    onPress={() => {
                      setMinutes(String(n));
                      setError('');
                    }}
                  />
                ))}
              </View>
            </>
          ) : (
            <Text
              accessibilityLabel={`残り ${formatRemaining(remaining)}`}
              style={{
                fontSize: 44,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
                color: colors.textPrimary,
              }}
            >
              {formatRemaining(remaining)}
            </Text>
          )}
          {finished ? (
            <Notice tone="success" message="時間になりました。タスクは自動完了していません。" />
          ) : timer.phase === 'paused' ? (
            <Text style={{ ...typography.body, color: colors.textSecondary }}>一時停止中</Text>
          ) : null}
          <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
            閉じてもタイマーは続き、アプリに戻ると残り時間を再計算します。アプリを完全終了するとリセットされます。通知・実績保存・タスクの自動完了は行いません。
          </Text>
        </ModalFrame>
      ) : null}
    </Context.Provider>
  );
}
