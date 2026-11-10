import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { DeadlineField } from '@/shared/components/DeadlineField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { FormField, FormInput } from '@/shared/components/FormField';
import { Notice } from '@/shared/components/Notice';
import { OptionGroup } from '@/shared/components/OptionGroup';
import { spacing } from '@/shared/theme';

import type { Goal } from '../repositories/GoalRepository';
import {
  createGoalFormValues,
  GOAL_PRIORITIES,
  GOAL_STATUSES,
  type GoalFormErrors,
  type GoalFormInput,
  type GoalFormValues,
  validateGoalForm,
} from '../validation';

type GoalFormModalProps = {
  errorMessage: string | null;
  goal: Goal | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: GoalFormInput) => Promise<boolean>;
};

export function GoalFormModal({
  errorMessage,
  goal,
  isSubmitting,
  onClose,
  onSubmit,
}: GoalFormModalProps) {
  const [values, setValues] = useState<GoalFormValues>(() =>
    createGoalFormValues(goal ?? undefined),
  );
  const [fieldErrors, setFieldErrors] = useState<GoalFormErrors>({});
  const submitLock = useRef(false);
  const isEditing = goal !== null;

  const updateValue = (field: keyof GoalFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async () => {
    if (isSubmitting || submitLock.current) return;

    const validation = validateGoalForm(values);

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
      title={isEditing ? '目標を編集' : '新しい目標'}
      onClose={onClose}
      closeLabel="目標フォームを閉じる"
      closeDisabled={isSubmitting}
      testID="goal-form-modal"
      footer={
        <ActionButton
          accessibilityLabel={isSubmitting ? '目標を保存中' : '目標を保存する'}
          disabled={isSubmitting}
          loading={isSubmitting}
          label={isSubmitting ? '保存中…' : isEditing ? '変更を保存' : '目標を作成'}
          onPress={() => void submit()}
          style={styles.submitButton}
        />
      }
    >
      <FormField error={fieldErrors.title} label="タイトル（必須）">
        <FormInput
          accessibilityLabel="目標タイトル"
          autoCapitalize="sentences"
          editable={!isSubmitting}
          maxLength={200}
          onChangeText={(value) => updateValue('title', value)}
          placeholder="例: TOEIC 730点"
          value={values.title}
        />
      </FormField>

      <FormField label="説明">
        <FormInput
          accessibilityLabel="目標の説明"
          editable={!isSubmitting}
          multiline
          onChangeText={(value) => updateValue('description', value)}
          placeholder="目標の背景や達成したい理由"
          style={styles.multilineInput}
          textAlignVertical="top"
          value={values.description}
        />
      </FormField>

      <DeadlineField
        accessibilityLabel="目標の期限"
        disabled={isSubmitting}
        error={fieldErrors.deadline}
        onChange={(value) => updateValue('deadline', value)}
        value={values.deadline}
      />

      <OptionGroup
        disabled={isSubmitting}
        error={fieldErrors.priority}
        label="優先度"
        onChange={(value) => updateValue('priority', value)}
        options={GOAL_PRIORITIES}
        selectedValue={values.priority}
      />

      <OptionGroup
        disabled={isSubmitting}
        error={fieldErrors.status}
        label="状態"
        onChange={(value) => updateValue('status', value)}
        options={GOAL_STATUSES}
        selectedValue={values.status}
      />

      {errorMessage ? <Notice tone="error" message={errorMessage} /> : null}
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  multilineInput: {
    minHeight: 96,
    paddingTop: spacing.md,
  },
  submitButton: {
    minHeight: 50,
  },
});
