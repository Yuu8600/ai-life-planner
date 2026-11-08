import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { FormField, FormInput } from '@/shared/components/FormField';
import { Notice } from '@/shared/components/Notice';
import { OptionGroup } from '@/shared/components/OptionGroup';
import { colors, radius, spacing } from '@/shared/theme';

import type { CreateTaskInput, Task, TaskGoalOption } from '../repositories/TaskRepository';
import {
  createTaskFormValues,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskFormErrors,
  type TaskFormValues,
  validateTaskForm,
} from '../validation';

type TaskFormModalProps = {
  errorMessage: string | null;
  goalOptions: readonly TaskGoalOption[];
  goalOptionsError: string | null;
  isLoadingGoalOptions: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onRetryGoalOptions: () => void;
  onSubmit: (input: CreateTaskInput) => Promise<boolean>;
  task: Task | null;
};

export function TaskFormModal({
  errorMessage,
  goalOptions,
  goalOptionsError,
  isLoadingGoalOptions,
  isSubmitting,
  onClose,
  onRetryGoalOptions,
  onSubmit,
  task,
}: TaskFormModalProps) {
  const [values, setValues] = useState<TaskFormValues>(() =>
    createTaskFormValues(task ?? undefined),
  );
  const [fieldErrors, setFieldErrors] = useState<TaskFormErrors>({});
  const submitLock = useRef(false);
  const isEditing = task !== null;
  const displayedGoalOptions = useMemo(() => {
    if (!task?.goalId || goalOptions.some((goal) => goal.id === task.goalId)) return goalOptions;

    return [{ id: task.goalId, title: '現在関連付け中のGoal' }, ...goalOptions];
  }, [goalOptions, task]);

  const updateValue = (field: keyof TaskFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async () => {
    if (isSubmitting || submitLock.current) return;

    const allowedGoalIds = new Set(displayedGoalOptions.map((goal) => goal.id));
    const validation = validateTaskForm(values, allowedGoalIds);

    if (!validation.input) {
      setFieldErrors(validation.errors);
      return;
    }

    submitLock.current = true;

    try {
      await onSubmit(validation.input);
    } finally {
      submitLock.current = false;
    }
  };

  return (
    <ModalFrame
      title={isEditing ? 'タスクを編集' : '新しいタスク'}
      description="実行時間と関連するGoalを登録します。"
      onClose={onClose}
      closeLabel="タスクフォームを閉じる"
      closeDisabled={isSubmitting}
      testID="task-form-modal"
      footer={
        <ActionButton
          accessibilityLabel={isSubmitting ? 'タスクを保存中' : 'タスクを保存する'}
          disabled={isSubmitting}
          loading={isSubmitting}
          label={isSubmitting ? '保存中…' : isEditing ? '変更を保存' : 'タスクを作成'}
          onPress={() => void submit()}
          style={styles.submitButton}
        />
      }
    >
      <FormField error={fieldErrors.title} label="タイトル（必須）">
        <FormInput
          accessibilityLabel="タスクタイトル"
          editable={!isSubmitting}
          maxLength={200}
          onChangeText={(value) => updateValue('title', value)}
          placeholder="例: TOEIC Listening"
          value={values.title}
        />
      </FormField>

      <View style={styles.valueRow}>
        <View style={styles.valueField}>
          <FormField error={fieldErrors.estimatedMinutes} label="所要時間（分・必須）">
            <FormInput
              accessibilityLabel="タスクの所要時間"
              editable={!isSubmitting}
              keyboardType="number-pad"
              onChangeText={(value) => updateValue('estimatedMinutes', value)}
              placeholder="30"
              value={values.estimatedMinutes}
            />
          </FormField>
        </View>
        <View style={styles.valueField}>
          <FormField error={fieldErrors.deadline} label="期限">
            <FormInput
              accessibilityLabel="タスクの期限"
              autoCapitalize="none"
              editable={!isSubmitting}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              onChangeText={(value) => updateValue('deadline', value)}
              placeholder="2026-10-25"
              value={values.deadline}
            />
          </FormField>
        </View>
      </View>

      <OptionGroup
        disabled={isSubmitting}
        error={fieldErrors.priority}
        label="優先度"
        onChange={(value) => updateValue('priority', value)}
        options={TASK_PRIORITIES}
        selectedValue={values.priority}
      />

      <OptionGroup
        disabled={isSubmitting}
        error={fieldErrors.status}
        label="状態"
        onChange={(value) => updateValue('status', value)}
        options={TASK_STATUSES}
        selectedValue={values.status}
      />

      <View style={styles.field}>
        <Text style={styles.label}>関連するGoal（任意）</Text>
        {isLoadingGoalOptions ? (
          <Text accessibilityLiveRegion="polite" style={styles.helperText}>
            Goal候補を読み込んでいます。
          </Text>
        ) : null}
        {goalOptionsError ? (
          <View style={styles.goalErrorRow}>
            <Text accessibilityRole="alert" style={styles.goalErrorText}>
              {goalOptionsError}
            </Text>
            <Pressable
              accessibilityLabel="Goal候補を再読み込み"
              accessibilityRole="button"
              disabled={isSubmitting || isLoadingGoalOptions}
              onPress={onRetryGoalOptions}
              style={({ pressed }) => [styles.retryButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.retryLabel}>再読み込み</Text>
            </Pressable>
          </View>
        ) : null}
        <View accessibilityRole="radiogroup" style={styles.goalOptions}>
          <GoalOption
            disabled={isSubmitting}
            label="Goalなし"
            onPress={() => updateValue('goalId', '')}
            selected={!values.goalId}
          />
          {displayedGoalOptions.map((goal) => (
            <GoalOption
              disabled={isSubmitting}
              key={goal.id}
              label={goal.title}
              onPress={() => updateValue('goalId', goal.id)}
              selected={values.goalId === goal.id}
            />
          ))}
        </View>
        {fieldErrors.goalId ? <Text style={styles.fieldError}>{fieldErrors.goalId}</Text> : null}
      </View>

      {errorMessage ? <Notice tone="error" message={errorMessage} /> : null}
    </ModalFrame>
  );
}

type GoalOptionProps = {
  disabled: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
};

function GoalOption({ disabled, label, onPress, selected }: GoalOptionProps) {
  return (
    <Pressable
      accessibilityLabel={`Goal ${label}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.goalOption,
        selected ? styles.selectedOption : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.optionLabel, selected ? styles.selectedOptionLabel : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, gap: spacing.sm },
  label: { color: colors.text, fontSize: 13, fontWeight: '700' },
  valueRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.md },
  valueField: { flexGrow: 1, flexBasis: 160, minWidth: 0 },
  goalOptions: { gap: spacing.sm },
  goalOption: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  selectedOption: { borderColor: colors.accentMuted, backgroundColor: colors.accentSoft },
  optionLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  selectedOptionLabel: { color: colors.accent },
  helperText: { color: colors.textMuted, fontSize: 13 },
  goalErrorRow: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
  },
  goalErrorText: { color: colors.warning, fontSize: 13, lineHeight: 19 },
  retryButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  retryLabel: { color: colors.warning, fontSize: 13, fontWeight: '700' },
  fieldError: { color: colors.warning, fontSize: 12, lineHeight: 18 },
  submitButton: { minHeight: 50 },
  pressed: { opacity: 0.7 },
});
