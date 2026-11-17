import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import type { Task, TaskRepository } from '@/features/tasks/repositories/TaskRepository';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { Card } from '@/shared/components/Card';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { OptionGroup } from '@/shared/components/OptionGroup';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { appAlert } from '@/shared/feedback/appAlert';
import { useTheme } from '@/shared/theme';

import {
  EFFORT_OPTIONS,
  isEffort,
  type ActionStep,
  type Effort,
  type RecommendationRepository,
} from './repository';

export function ActionStepsScreen({
  taskId,
  initialMinutes,
  tasks,
  repository,
  close,
  openAI,
}: {
  taskId: string;
  initialMinutes?: number;
  tasks: TaskRepository;
  repository: RecommendationRepository;
  close: () => void;
  openAI: (task: Task) => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const [data, setData] = useState<{ task: Task; steps: ActionStep[] }>();
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<ActionStep | null | undefined>();
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const autoOpened = useRef(false);

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
        if (initialMinutes && !autoOpened.current) {
          autoOpened.current = true;
          setEditor(null);
        }
      },
      () => {
        if (active) setError('小さな行動を読み込めませんでした。再試行してください。');
      },
    );
    return () => {
      active = false;
    };
  }, [taskId, tasks, repository, initialMinutes, retry]);

  function remove(step: ActionStep) {
    appAlert.alert('小さな行動を削除しますか？', step.title, [
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
    ]);
  }

  return (
    <AppScreen contentContainerStyle={{ gap: spacing.md }}>
      <ScreenHeader
        title="小さな行動"
        subtitle={data?.task.title}
        action={<ActionButton label="戻る" variant="ghost" onPress={close} />}
      />
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
      {!data && !error ? <Text style={{ color: colors.textSecondary }}>読み込み中…</Text> : null}
      {data ? (
        <>
          <ActionButton
            label="小さな行動を追加"
            disabled={pending}
            onPress={() => setEditor(null)}
          />
          <ActionButton
            label="AIで小さな行動を考える"
            variant="secondary"
            disabled={pending}
            onPress={() => openAI(data.task)}
          />
          {!data.steps.length ? (
            <Text style={{ ...typography.body, color: colors.textSecondary }}>
              取り組みやすい一歩を、このタスクに追加できます。
            </Text>
          ) : null}
          {data.steps.map((step) => (
            <Card key={step.id} style={{ gap: spacing.sm }}>
              <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>
                {step.title}
              </Text>
              <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
                {[
                  step.minutes === null ? '所要時間未設定' : `${step.minutes}分`,
                  step.repeatable ? '繰り返し使う' : '一度だけ',
                  ...(step.completed ? ['完了'] : []),
                ].join(' ・ ')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
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
                  variant="ghost"
                  disabled={pending}
                  onPress={() => remove(step)}
                />
              </View>
            </Card>
          ))}
          {editor !== undefined ? (
            <StepEditor
              step={editor}
              initialMinutes={initialMinutes}
              close={() => setEditor(undefined)}
              save={async (input) => {
                const saved = editor
                  ? await repository.updateStep(editor.id, input)
                  : await repository.addStep(taskId, input);
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
  );
}

function StepEditor({
  step,
  initialMinutes,
  close,
  save,
}: {
  step: ActionStep | null;
  initialMinutes?: number;
  close: () => void;
  save: (input: Pick<ActionStep, 'title' | 'minutes' | 'effort' | 'repeatable'>) => Promise<void>;
}) {
  const [title, setTitle] = useState(step?.title ?? '');
  const [minutes, setMinutes] = useState(String((step ? step.minutes : initialMinutes) ?? ''));
  const [effort, setEffort] = useState<Effort | null>(step?.effort ?? null);
  const [repeatable, setRepeatable] = useState(step?.repeatable ?? false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);

  async function submit() {
    if (lock.current) return;
    const value = minutes.trim();
    if (
      !title.trim() ||
      (value && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 1440))
    ) {
      setError('名前と所要時間を確認してください。時間は空欄または1〜1440分で入力できます。');
      return;
    }
    lock.current = true;
    setPending(true);
    setError('');
    try {
      await save({
        title: title.trim(),
        minutes: value ? Number(value) : null,
        effort,
        repeatable,
      });
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
        label="負担の目安"
        disabled={pending}
        selectedValue={effort ?? ''}
        options={[{ label: '未設定', value: '' }, ...EFFORT_OPTIONS]}
        onChange={(value) => setEffort(isEffort(value) ? value : null)}
      />
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
