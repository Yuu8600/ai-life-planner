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

      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <FormField error={fieldErrors.planningStart} label="活動開始時間">
            <TextInput
              accessibilityLabel="活動開始時間"
              autoCapitalize="none"
              editable={!isSaving}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              onChangeText={(value) => updateValue('planningStart', value)}
              placeholder="08:00"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
              value={values.planningStart}
            />
          </FormField>
        </View>
        <View style={styles.timeField}>
          <FormField error={fieldErrors.planningEnd} label="活動終了時間">
            <TextInput
              accessibilityLabel="活動終了時間"
              autoCapitalize="none"
              editable={!isSaving}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              onChangeText={(value) => updateValue('planningEnd', value)}
              placeholder="23:00"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
              value={values.planningEnd}
            />
          </FormField>
        </View>
      </View>

      <FormField
        error={fieldErrors.minimumFreeMinutes}
        helper="AIが行動を配置できる空き時間の最小値です。"
        label="最小空き時間（分）"
      >
        <TextInput
          accessibilityLabel="最小空き時間"
          editable={!isSaving}
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={(value) => updateValue('minimumFreeMinutes', value)}
          placeholder="20"
          placeholderTextColor={colors.textSubtle}
          style={styles.input}
          value={values.minimumFreeMinutes}
        />
      </FormField>

      {(['Before', 'After'] as const).map((side) => {
        const label = side === 'Before' ? '予定前の余白時間' : '予定後の余白時間';
        const hoursKey = `calendarBuffer${side}Hours` as const;
        const minutesKey = `calendarBuffer${side}Minutes` as const;
        return (
          <FormField
            key={side}
            label={label}
            helper="合計0〜4時間。Calendar予定の時刻は変更しません。"
            error={fieldErrors[minutesKey]}
          >
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <TextInput
                  accessibilityLabel={`${label}（時間）`}
                  value={values[hoursKey]}
                  onChangeText={(value) => updateValue(hoursKey, value)}
                  keyboardType="number-pad"
                  editable={!isSaving}
                  style={styles.input}
                />
                <Text style={styles.helper}>時間</Text>
              </View>
              <View style={styles.timeField}>
                <TextInput
                  accessibilityLabel={`${label}（分）`}
                  value={values[minutesKey]}
                  onChangeText={(value) => updateValue(minutesKey, value)}
                  keyboardType="number-pad"
                  editable={!isSaving}
                  style={styles.input}
                />
                <Text style={styles.helper}>分</Text>
              </View>
            </View>
          </FormField>
        );
      })}
      <Text style={styles.helper}>
        保存済みの計画は変わりません。新しい余白を反映するには、明示的に再計画してください。
      </Text>

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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  timeField: {
    flex: 1,
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
