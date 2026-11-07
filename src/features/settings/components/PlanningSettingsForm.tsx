import { TimeSelectionRow } from '@/shared/components/timeSelection/TimeSelectionRow';
import { DurationSelectionRow } from '@/shared/components/timeSelection/DurationSelectionRow';
import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { colors, radius, spacing } from '@/shared/theme';

import type {
  ProfilePlanningSettings,
  UpdateProfilePlanningSettingsInput,
} from '../repositories/SettingsRepository';
import {
  createSettingsFormValues,
  type SettingsFormErrors,
  type SettingsFormValues,
  validateSettingsForm,
} from '../validation';

type PlanningSettingsFormProps = {
  clearSaveFeedback: () => void;
  isSaving: boolean;
  onSubmit: (input: UpdateProfilePlanningSettingsInput) => Promise<boolean>;
  saveError: string | null;
  saveSucceeded: boolean;
  settings: ProfilePlanningSettings;
};

export function PlanningSettingsForm({
  clearSaveFeedback,
  isSaving,
  onSubmit,
  saveError,
  saveSucceeded,
  settings,
}: PlanningSettingsFormProps) {
  const [values, setValues] = useState<SettingsFormValues>(() =>
    createSettingsFormValues(settings),
  );
  const [fieldErrors, setFieldErrors] = useState<SettingsFormErrors>({});
  const submitLock = useRef(false);

  const updateValue = (field: keyof SettingsFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    clearSaveFeedback();
  };

  const submit = async () => {
    if (isSaving || submitLock.current) return;

    const validation = validateSettingsForm(values);

    if (!validation.input) {
      setFieldErrors(validation.errors);
      clearSaveFeedback();
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
    <View style={styles.form} testID="planning-settings-form">
      <FormField
        error={fieldErrors.timezone}
        helper="IANA形式で入力します。例: Asia/Tokyo"
        label="タイムゾーン"
      >
        <TextInput
          accessibilityLabel="タイムゾーン"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSaving}
          maxLength={100}
          onChangeText={(value) => updateValue('timezone', value)}
          placeholder="Asia/Tokyo"
          placeholderTextColor={colors.textSubtle}
          style={styles.input}
          value={values.timezone}
        />
      </FormField>

      <TimeSelectionRow
        label="活動開始時間"
        value={values.planningStart}
        disabled={isSaving}
        onChange={(time) => updateValue('planningStart', time)}
      />
      <TimeSelectionRow
        label="活動終了時間"
        value={values.planningEnd}
        dayOffset={values.planningEndDayOffset}
        disabled={isSaving}
        onChange={(time, offset) => {
          updateValue('planningEnd', time);
          updateValue('planningEndDayOffset', offset ?? '0');
        }}
      />
      <Text style={styles.helper}>
        {(() => {
          const minutes = (text: string) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3));
          const duration =
            Number(values.planningEndDayOffset) * 1440 +
            minutes(values.planningEnd) -
            minutes(values.planningStart);
          return duration > 0 && duration <= 1440
            ? `活動時間 ${Math.floor(duration / 60)}時間${duration % 60 ? `${duration % 60}分` : ''}`
            : '活動時間は0分より長く、24時間以内にしてください。';
        })()}
      </Text>
      {fieldErrors.planningStart || fieldErrors.planningEnd || fieldErrors.planningEndDayOffset ? (
        <Text style={styles.fieldError}>
          {fieldErrors.planningStart ?? fieldErrors.planningEnd ?? fieldErrors.planningEndDayOffset}
        </Text>
      ) : null}
      <DurationSelectionRow
        label="最小空き時間"
        value={values.minimumFreeMinutes}
        disabled={isSaving}
        onChange={(value) => updateValue('minimumFreeMinutes', value)}
      />
      {fieldErrors.minimumFreeMinutes ? (
        <Text style={styles.fieldError}>{fieldErrors.minimumFreeMinutes}</Text>
      ) : null}
      {(['Before', 'After'] as const).map((side) => {
        const hoursKey = `calendarBuffer${side}Hours` as const,
          minutesKey = `calendarBuffer${side}Minutes` as const;
        return (
          <DurationSelectionRow
            key={side}
            label={side === 'Before' ? '予定前の余白時間' : '予定後の余白時間'}
            buffer
            value={String(Number(values[hoursKey]) * 60 + Number(values[minutesKey]))}
            disabled={isSaving}
            onChange={(value) => {
              updateValue(hoursKey, String(Math.floor(Number(value) / 60)));
              updateValue(minutesKey, String(Number(value) % 60));
            }}
          />
        );
      })}
      {saveError ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.errorBox}>
          {saveError}
        </Text>
      ) : null}

      {saveSucceeded ? (
        <Text accessibilityLiveRegion="polite" style={styles.successBox}>
          設定を保存しました。
        </Text>
      ) : null}

      <ActionButton
        accessibilityLabel={isSaving ? 'プロフィール設定を保存中' : 'プロフィール設定を保存する'}
        disabled={isSaving}
        label={isSaving ? '保存中…' : '変更を保存'}
        onPress={() => void submit()}
        style={styles.submitButton}
      />
    </View>
  );
}

type FormFieldProps = {
  children: ReactNode;
  error?: string;
  helper?: string;
  label: string;
};

function FormField({ children, error, helper, label }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
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
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 16,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
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
  successBox: {
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  submitButton: {
    minHeight: 50,
  },
});
