import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { colors, radius, spacing } from '@/shared/theme';

import type { CreateGoalInput, Goal } from '../repositories/GoalRepository';
import {
  createGoalFormValues,
  GOAL_PRIORITIES,
  GOAL_STATUSES,
  type GoalFormErrors,
  type GoalFormValues,
  validateGoalForm,
} from '../validation';

type GoalFormModalProps = {
  errorMessage: string | null;
  goal: Goal | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: CreateGoalInput) => Promise<boolean>;
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
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!isSubmitting) onClose();
      }}
      presentationStyle="pageSheet"
      visible
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <AppScreen contentContainerStyle={styles.content} testID="goal-form-modal">
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={styles.title}>
                {isEditing ? '目標を編集' : '新しい目標'}
              </Text>
              <Text style={styles.subtitle}>目標の状態と進捗を登録します。</Text>
            </View>
            <Pressable
              accessibilityLabel="目標フォームを閉じる"
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && !isSubmitting ? styles.pressed : null,
              ]}
            >
              <Text style={styles.closeLabel}>閉じる</Text>
            </Pressable>
          </View>

          <FormField error={fieldErrors.title} label="タイトル（必須）">
            <TextInput
              accessibilityLabel="目標タイトル"
              autoCapitalize="sentences"
              editable={!isSubmitting}
              maxLength={200}
              onChangeText={(value) => updateValue('title', value)}
              placeholder="例: TOEIC 730点"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
              value={values.title}
            />
          </FormField>

          <FormField label="説明">
            <TextInput
              accessibilityLabel="目標の説明"
              editable={!isSubmitting}
              multiline
              onChangeText={(value) => updateValue('description', value)}
              placeholder="目標の背景や達成したい理由"
              placeholderTextColor={colors.textSubtle}
              style={[styles.input, styles.multilineInput]}
              textAlignVertical="top"
              value={values.description}
            />
          </FormField>

          <View style={styles.valueRow}>
            <View style={styles.valueField}>
              <FormField error={fieldErrors.currentValue} label="現在値">
                <TextInput
                  accessibilityLabel="目標の現在値"
                  editable={!isSubmitting}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => updateValue('currentValue', value)}
                  placeholder="530"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                  value={values.currentValue}
                />
              </FormField>
            </View>
            <View style={styles.valueField}>
              <FormField error={fieldErrors.targetValue} label="目標値">
                <TextInput
                  accessibilityLabel="目標の目標値"
                  editable={!isSubmitting}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => updateValue('targetValue', value)}
                  placeholder="730"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                  value={values.targetValue}
                />
              </FormField>
            </View>
          </View>

          <View style={styles.valueRow}>
            <View style={styles.valueField}>
              <FormField label="単位">
                <TextInput
                  accessibilityLabel="目標の単位"
                  editable={!isSubmitting}
                  maxLength={30}
                  onChangeText={(value) => updateValue('unit', value)}
                  placeholder="点、%、冊"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                  value={values.unit}
                />
              </FormField>
            </View>
            <View style={styles.valueField}>
              <FormField error={fieldErrors.deadline} label="期限">
                <TextInput
                  accessibilityLabel="目標の期限"
                  autoCapitalize="none"
                  editable={!isSubmitting}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  onChangeText={(value) => updateValue('deadline', value)}
                  placeholder="2026-10-25"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
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

          {errorMessage ? (
            <Text
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              style={styles.errorBox}
            >
              {errorMessage}
            </Text>
          ) : null}

          <ActionButton
            accessibilityLabel={isSubmitting ? '目標を保存中' : '目標を保存する'}
            disabled={isSubmitting}
            label={isSubmitting ? '保存中…' : isEditing ? '変更を保存' : '目標を作成'}
            onPress={() => void submit()}
            style={styles.submitButton}
          />
        </AppScreen>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type FormFieldProps = {
  children: React.ReactNode;
  error?: string;
  label: string;
};

function FormField({ children, error, label }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type OptionGroupProps = {
  disabled: boolean;
  error?: string;
  label: string;
  onChange: (value: string) => void;
  options: readonly { label: string; value: string }[];
  selectedValue: string;
};

function OptionGroup({
  disabled,
  error,
  label,
  onChange,
  options,
  selectedValue,
}: OptionGroupProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {options.map((option) => {
          const selected = option.value === selectedValue;

          return (
            <Pressable
              accessibilityLabel={`${label} ${option.label}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.option,
                selected ? styles.selectedOption : null,
                pressed && !disabled ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.optionLabel, selected ? styles.selectedOptionLabel : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 14,
  },
  closeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  closeLabel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  field: {
    flex: 1,
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 96,
    paddingTop: spacing.md,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  valueField: {
    flex: 1,
  },
  options: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  selectedOption: {
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSoft,
  },
  optionLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  selectedOptionLabel: {
    color: colors.accent,
  },
  fieldError: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
    color: colors.warning,
    fontSize: 13,
    lineHeight: 19,
  },
  submitButton: {
    minHeight: 50,
  },
  pressed: {
    opacity: 0.7,
  },
});
