import { useFocusTimer } from '@/features/focus-timer';
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';

import type { Task, TaskRepository } from '@/features/tasks';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { Badge } from '@/shared/components/Badge';
import { CompletionCheckbox } from '@/shared/components/CompletionCheckbox';
import { Card } from '@/shared/components/Card';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { OptionGroup } from '@/shared/components/OptionGroup';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { ToastBanner } from '@/shared/components/ToastBanner';
import { confirmDiscardChanges } from '@/shared/feedback/confirmDiscardChanges';
import { appAlert } from '@/shared/feedback/appAlert';
import { useTheme } from '@/shared/theme';

import {
  type ActionStep,
  type Effort,
  type RecommendationResult,
  type RecommendationRepository,
} from './repository';

function stepInput(
  title: string,
  minutes: string,
  effort: Effort | null = null,
  repeatable = false,
): Pick<ActionStep, 'title' | 'minutes' | 'effort' | 'repeatable'> {
  const value = minutes.trim();
  if (
    !title.trim() ||
    title.trim().length > 200 ||
    (value && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 1440))
  )
    throw new Error('名前と所要時間を確認してください。時間は空欄または1〜1440分で入力できます。');
  return { title: title.trim(), minutes: value ? Number(value) : null, effort, repeatable };
}

export function ActionStepsScreen({
  taskId,
  initialMinutes,
  date,
  revision,
  dayError,
  refreshDay,
  tasks,
  repository,
  close,
  openAI,
  ExitGuard,
}: {
  taskId: string;
  ExitGuard?: ComponentType<{ dirty: boolean; pending: boolean }>;
  initialMinutes?: number;
  date?: string;
  revision: number;
  dayError: string;
  refreshDay: () => void;
  tasks: TaskRepository;
  repository: RecommendationRepository;
  close: () => void;
  openAI: (task: Task) => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const timer = useFocusTimer();
  const [data, setData] = useState<{ task: Task; steps: ActionStep[] }>();
  const [retry, setRetry] = useState(0);
  const [daily, setDaily] = useState<{ date: string; results: RecommendationResult[] }>();
  const [dailyError, setDailyError] = useState('');
  const todayResults = daily?.date === date ? (daily?.results ?? []) : [];
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<ActionStep | null | undefined>();
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const autoFocused = useRef(false);
  const initialDuration = String(initialMinutes ?? '');
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineMinutes, setInlineMinutes] = useState(initialDuration);
  const [inlineError, setInlineError] = useState('');
  const inlineInput = useRef<TextInput>(null);
  const inlineDirty = !!inlineTitle.trim() || inlineMinutes !== initialDuration;
  function leave(action: () => void) {
    if (lock.current) return;
    confirmDiscardChanges(inlineDirty, () => {
      setInlineTitle('');
      setInlineMinutes(initialDuration);
      action();
    });
  }
  async function addInline() {
    if (!data || lock.current) return;
    let input: ReturnType<typeof stepInput>;
    try {
      input = stepInput(inlineTitle, inlineMinutes);
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : '入力を確認してください。');
      return;
    }
    lock.current = true;
    setPending(true);
    setInlineError('');
    setFeedback('');
    try {
      const saved = await repository.addStep(taskId, input);
      setData(
        (old) =>
          old && { ...old, steps: [...old.steps.filter((step) => step.id !== saved.id), saved] },
      );
      setInlineTitle('');
      setInlineMinutes(initialDuration);
      setFeedback('小さな行動を追加しました。続けて入力できます。');
      requestAnimationFrame(() => inlineInput.current?.focus());
    } catch {
      setInlineError('小さな行動を保存できませんでした。再試行してください。');
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  useEffect(() => {
    let active = true;
    void Promise.all([tasks.findById(taskId), repository.listSteps(taskId)]).then(
      ([task, steps]) => {
        if (!active) return;
        if (!task) {
          setError('タスクが見つかりません。');
          return;
        }
        setData({ task, steps });
        setError('');
        if (initialMinutes && !autoFocused.current) {
          autoFocused.current = true;
          requestAnimationFrame(() => inlineInput.current?.focus());
        }
      },
      () => {
        if (active) setError('小さな行動を読み込めませんでした。再試行してください。');
      },
    );
    return () => {
      active = false;
    };
  }, [taskId, tasks, repository, initialMinutes, retry, revision]);

  useEffect(() => {
    if (!date) return;
    let active = true;
    void repository.listResults(date, date).then(
      (results) => {
        if (!active) return;
        setDaily({ date, results });
        setDailyError('');
      },
      () => {
        if (active) setDailyError('今日の実施記録を読み込めませんでした。');
      },
    );
    return () => {
      active = false;
    };
  }, [date, repository, revision, retry]);

  async function toggle(step: ActionStep, result?: RecommendationResult) {
    if (!date || lock.current) return;
    lock.current = true;
    setPending(true);
    setFeedback('');
    try {
      if (result) {
        await repository.undo(date, 'step', step.id, result.outcome);
        setFeedback(
          result.outcome === 'skipped'
            ? '今日のおすすめ対象に戻しました。'
            : '今日の実施記録を取り消しました。',
        );
      } else {
        const outcome = await repository.record(date, 'step', step.id, 'completed');
        setFeedback(
          outcome === 'skipped'
            ? '今日はあとでにしています。'
            : step.repeatable
              ? '今日の実施を記録しました。'
              : '小さな行動を完了しました。',
        );
      }
      const [results, steps] = await Promise.all([
        repository.listResults(date, date),
        repository.listSteps(taskId),
      ]);
      setDaily({ date, results });
      setData((previous) => previous && { ...previous, steps });
    } catch {
      setDailyError('実施記録を更新できませんでした。再読み込みしてください。');
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  function remove(step: ActionStep) {
    appAlert.alert(
      '小さな行動を削除しますか？',
      `「${step.title}」を削除します。この操作は取り消せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            if (lock.current) return;
            lock.current = true;
            setPending(true);
            void repository
              .removeStep(step.id)
              .then(
                () =>
                  setData(
                    (previous) =>
                      previous && {
                        ...previous,
                        steps: previous.steps.filter((item) => item.id !== step.id),
                      },
                  ),
                () => setError('削除できませんでした。再試行してください。'),
              )
              .finally(() => {
                lock.current = false;
                setPending(false);
              });
          },
        },
      ],
    );
  }

  const dismissFeedback = useCallback(() => setFeedback(''), []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <AppScreen
        contentContainerStyle={{ gap: spacing.md }}
        overlay={feedback ? <ToastBanner message={feedback} onDismiss={dismissFeedback} /> : null}
        header={
          <ScreenHeader
            title="小さな行動"
            subtitle={data?.task.title}
            backAction={{
              label: '戻る',
              disabled: pending,
              onPress: () => (ExitGuard ? close() : leave(close)),
            }}
          />
        }
      >
        {ExitGuard ? <ExitGuard dirty={inlineDirty} pending={pending} /> : null}
        {error ? (
          <Notice
            tone="error"
            message={error}
            action={
              <ActionButton
                label="再試行"
                variant="secondary"
                onPress={() => setRetry((count) => count + 1)}
              />
            }
          />
        ) : null}
        {dayError || dailyError ? (
          <Notice
            tone="warning"
            message={dayError || dailyError}
            action={
              <ActionButton label="実施記録を再読み込み" variant="secondary" onPress={refreshDay} />
            }
          />
        ) : null}
        {!data && !error ? <Text style={{ color: colors.textSecondary }}>読み込み中…</Text> : null}
        {data ? (
          <>
            <Card>
              <FormField label="一歩を追加">
                <FormInput
                  ref={inlineInput}
                  accessibilityLabel="追加する小さな行動の名前"
                  value={inlineTitle}
                  maxLength={200}
                  placeholder="例：最初の1ページを読む"
                  editable={!pending}
                  returnKeyType="done"
                  submitBehavior="submit"
                  onChangeText={(value) => {
                    setInlineTitle(value);
                    setInlineError('');
                  }}
                  onSubmitEditing={() => void addInline()}
                />
              </FormField>
              <FormField label="所要時間の目安（分・任意）">
                <FormInput
                  accessibilityLabel="追加する小さな行動の所要時間"
                  value={inlineMinutes}
                  keyboardType="number-pad"
                  editable={!pending}
                  onChangeText={(value) => {
                    setInlineMinutes(value);
                    setInlineError('');
                  }}
                />
              </FormField>
              <ActionButton
                label="追加"
                accessibilityLabel="小さな行動をクイック追加"
                disabled={!inlineTitle.trim()}
                loading={pending}
                onPress={() => void addInline()}
              />
              <ActionButton
                label="詳細を指定して追加"
                accessibilityLabel="詳細を指定して小さな行動を追加"
                variant="ghost"
                disabled={pending}
                onPress={() => setEditor(null)}
              />
              {inlineError ? <Notice tone="error" message={inlineError} /> : null}
            </Card>
            <ActionButton
              label="AIで小さな行動を考える"
              variant="secondary"
              disabled={pending}
              onPress={() => leave(() => openAI(data.task))}
            />
            {!data.steps.length ? (
              <Text style={{ ...typography.body, color: colors.textSecondary }}>
                取り組みやすい一歩を、このタスクに追加できます。
              </Text>
            ) : null}
            {data.steps.map((step) => {
              const result = todayResults.find(
                (item) => item.kind === 'step' && item.targetId === step.id,
              );
              const checked = step.completed || result?.outcome === 'completed';
              const parentOpen = data.task.status !== 'completed' && data.task.status !== 'skipped';
              const canToggle =
                !pending &&
                !dailyError &&
                !dayError &&
                !!date &&
                daily?.date === date &&
                (!!result || (!checked && parentOpen));
              return (
                <Card key={step.id} style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
                    {result?.outcome === 'skipped' ? (
                      <ActionButton
                        label="戻す"
                        accessibilityLabel={`${step.title}をおすすめ対象に戻す`}
                        variant="ghost"
                        disabled={!canToggle}
                        onPress={() => void toggle(step, result)}
                      />
                    ) : (
                      <CompletionCheckbox
                        checked={checked}
                        disabled={!canToggle}
                        label={
                          step.repeatable
                            ? `${step.title}の今日の実施を${checked ? '取り消す' : '記録'}`
                            : `${step.title}を${checked ? '未完了に戻す' : '完了'}`
                        }
                        onPress={() => void toggle(step, result)}
                      />
                    )}
                    <Text style={{ ...typography.bodyStrong, color: colors.textPrimary, flex: 1 }}>
                      {step.title}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <Badge
                      label={step.minutes === null ? '所要時間未設定' : `${step.minutes}分`}
                      tone="neutral"
                    />
                    <Badge
                      label={step.repeatable ? '繰り返し使う' : '一度だけ'}
                      tone={step.repeatable ? 'accent' : 'neutral'}
                    />
                    {checked ? (
                      <Badge
                        label={step.repeatable ? '今日の実施済み' : result ? '完了' : '過去に完了'}
                        tone="success"
                      />
                    ) : null}
                    {result?.outcome === 'skipped' ? (
                      <Badge label="今日だけあとで" tone="neutral" />
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    {timer ? (
                      <ActionButton
                        label="タイマー"
                        accessibilityLabel={`${step.title}の作業タイマーを開く`}
                        variant="ghost"
                        disabled={pending}
                        onPress={() =>
                          timer.open({
                            kind: 'step',
                            id: step.id,
                            title: step.title,
                            initialMinutes: step.minutes,
                          })
                        }
                      />
                    ) : null}
                    <ActionButton
                      label="編集"
                      accessibilityLabel={`${step.title}を編集`}
                      variant="ghost"
                      disabled={pending}
                      onPress={() => setEditor(step)}
                    />
                    <ActionButton
                      label="削除"
                      accessibilityLabel={`${step.title}を削除`}
                      variant="destructive"
                      disabled={pending}
                      onPress={() => remove(step)}
                    />
                  </View>
                </Card>
              );
            })}
            {editor !== undefined ? (
              <StepEditor
                step={editor}
                initialMinutes={initialMinutes}
                initialValues={
                  editor === null ? { title: inlineTitle, minutes: inlineMinutes } : undefined
                }
                close={() => setEditor(undefined)}
                save={async (input) => {
                  const saved = editor
                    ? await repository.updateStep(editor.id, input)
                    : await repository.addStep(taskId, input);
                  if (!editor) {
                    setInlineTitle('');
                    setInlineMinutes(initialDuration);
                    setInlineError('');
                  }
                  setData(
                    (previous) =>
                      previous && {
                        ...previous,
                        steps: editor
                          ? previous.steps.map((item) => (item.id === saved.id ? saved : item))
                          : [...previous.steps, saved],
                      },
                  );
                }}
              />
            ) : null}
          </>
        ) : null}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function StepEditor({
  step,
  initialMinutes,
  initialValues,
  close,
  save,
}: {
  step: ActionStep | null;
  initialValues?: { title: string; minutes: string };
  initialMinutes?: number;
  close: () => void;
  save: (input: Pick<ActionStep, 'title' | 'minutes' | 'effort' | 'repeatable'>) => Promise<void>;
}) {
  const [title, setTitle] = useState(step?.title ?? initialValues?.title ?? '');
  const [minutes, setMinutes] = useState(
    String(step ? (step.minutes ?? '') : (initialValues?.minutes ?? initialMinutes ?? '')),
  );
  const effort: Effort | null = step?.effort ?? null;
  const [repeatable, setRepeatable] = useState(step?.repeatable ?? false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [initialSnapshot] = useState(() => JSON.stringify({ title, minutes, repeatable }));
  const dirty = JSON.stringify({ title, minutes, repeatable }) !== initialSnapshot;

  async function submit() {
    if (lock.current) return;
    let input: ReturnType<typeof stepInput>;
    try {
      input = stepInput(title, minutes, effort, repeatable);
    } catch (error) {
      setError(error instanceof Error ? error.message : '入力を確認してください。');
      return;
    }
    lock.current = true;
    setPending(true);
    setError('');
    try {
      await save(input);
      close();
    } catch {
      setError('小さな行動を保存できませんでした。再試行してください。');
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  return (
    <ModalFrame
      title={step ? '小さな行動を編集' : '小さな行動を追加'}
      onClose={close}
      closeDisabled={pending}
      dirty={dirty}
      footer={<ActionButton label="保存" loading={pending} onPress={() => void submit()} />}
    >
      <FormField label="何をする？">
        <FormInput
          accessibilityLabel="小さな行動の名前"
          maxLength={200}
          value={title}
          placeholder="例：英単語を15個復習する"
          onChangeText={setTitle}
          editable={!pending}
        />
      </FormField>
      <FormField label="所要時間の目安（分・任意）">
        <FormInput
          accessibilityLabel="小さな行動の所要時間"
          value={minutes}
          keyboardType="number-pad"
          onChangeText={setMinutes}
          editable={!pending}
        />
      </FormField>
      <OptionGroup
        label="完了後の扱い"
        disabled={pending || step?.completed === true}
        selectedValue={repeatable ? 'repeat' : 'once'}
        options={[
          { label: '一度だけ', value: 'once' },
          { label: '繰り返し使う', value: 'repeat' },
        ]}
        onChange={(value) => setRepeatable(value === 'repeat')}
      />
      {error ? <Notice tone="error" message={error} /> : null}
    </ModalFrame>
  );
}
