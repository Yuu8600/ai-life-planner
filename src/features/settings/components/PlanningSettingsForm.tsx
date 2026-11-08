import { FormField, FormInput } from '@/shared/components/FormField';
import { Notice } from '@/shared/components/Notice';
import { TimeSelectionRow } from '@/shared/components/timeSelection/TimeSelectionRow';
import { DurationSelectionRow } from '@/shared/components/timeSelection/DurationSelectionRow';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { colors, radius, spacing, typography } from '@/shared/theme';

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
        <FormInput
          accessibilityLabel="タイムゾーン"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSaving}
          maxLength={100}
          onChangeText={(value) => updateValue('timezone', value)}
          placeholder="Asia/Tokyo"
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
      {saveError ? <Notice tone="error" message={saveError} /> : null}

      {saveSucceeded ? <Notice tone="success" message="設定を保存しました。" /> : null}

      <ActionButton
        accessibilityLabel={isSaving ? 'プロフィール設定を保存中' : 'プロフィール設定を保存する'}
        disabled={isSaving}
        loading={isSaving}
        label={isSaving ? '保存中…' : '変更を保存'}
        onPress={() => void submit()}
        style={styles.submitButton}
      />
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
  helper: {
    color: colors.textMuted,
    ...typography.secondary,
  },
  fieldError: {
    color: colors.error,
    ...typography.secondary,
  },
  submitButton: {
    minHeight: 50,
  },
});
