import type { ReactNode } from 'react';
import { Card } from '@/shared/components/Card';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { FormField, FormInput } from '@/shared/components/FormField';
import { Notice } from '@/shared/components/Notice';
import { TimeSelectionRow } from '@/shared/components/timeSelection/TimeSelectionRow';
import { DurationSelectionRow } from '@/shared/components/timeSelection/DurationSelectionRow';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { colors, spacing, typography } from '@/shared/theme';

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
  renderLayout?: (
    body: ReactNode,
    footer: ReactNode,
    dirty: boolean,
    feedback: ReactNode,
  ) => ReactNode;
  clearSaveFeedback: () => void;
  isSaving: boolean;
  onSubmit: (input: UpdateProfilePlanningSettingsInput) => Promise<boolean>;
  saveError: string | null;
  saveSucceeded: boolean;
  settings: ProfilePlanningSettings;
};

export function PlanningSettingsForm({
  clearSaveFeedback,
  renderLayout,
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
  const saveAreaRef = useRef<View>(null);
  useEffect(() => {
    if ((!saveSucceeded && !saveError) || Platform.OS !== 'web') return;
    const frame = requestAnimationFrame(() => saveAreaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [saveSucceeded, saveError]);
  const [savedDraft, setSavedDraft] = useState(() => createSettingsFormValues(settings));
  const currentSettings = useRef(settings);
  useLayoutEffect(() => {
    currentSettings.current = settings;
  }, [settings]);
  const [sourceSettings, setSourceSettings] = useState(settings);
  if (settings !== sourceSettings) {
    const next = createSettingsFormValues(settings);
    setSourceSettings(settings);
    setValues(next);
    setSavedDraft(next);
    setFieldErrors({});
  }
  const dirty = JSON.stringify(values) !== JSON.stringify(savedDraft);

  const updateValue = (field: keyof SettingsFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    clearSaveFeedback();
  };

  const submit = async () => {
    if (isSaving || submitLock.current) return;

    Keyboard.dismiss();
    const validation = validateSettingsForm(values);

    if (!validation.input) {
      setFieldErrors(validation.errors);
      clearSaveFeedback();
      return;
    }

    submitLock.current = true;

    try {
      const submittedSettings = currentSettings.current;
      if (await onSubmit(validation.input)) {
        // A returned profile row wins over the submitted draft, including server normalization.
        if (currentSettings.current === submittedSettings) setSavedDraft(values);
      }
    } finally {
      submitLock.current = false;
    }
  };

  const body = (
    <View style={styles.form} testID="planning-settings-form">
      <Card>
        <SectionHeader compact title="活動時間" />
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
        {fieldErrors.planningStart ||
        fieldErrors.planningEnd ||
        fieldErrors.planningEndDayOffset ? (
          <Text accessibilityRole="alert" style={styles.fieldError}>
            {fieldErrors.planningStart ??
              fieldErrors.planningEnd ??
              fieldErrors.planningEndDayOffset}
          </Text>
        ) : null}
      </Card>
      <Card>
        <SectionHeader compact title="空き時間・予定の余白" />
        <DurationSelectionRow
          label="最小空き時間"
          value={values.minimumFreeMinutes}
          disabled={isSaving}
          onChange={(value) => updateValue('minimumFreeMinutes', value)}
        />
        {fieldErrors.minimumFreeMinutes ? (
          <Text accessibilityRole="alert" style={styles.fieldError}>
            {fieldErrors.minimumFreeMinutes}
          </Text>
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
      </Card>
      <Card>
        <SectionHeader compact title="地域・時間帯" />
        <FormField
          error={fieldErrors.timezone}
          helper="例: Asia/Tokyo（IANA形式）"
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
      </Card>
      <Text style={styles.helper}>
        保存済みの計画は自動変更されません。反映には明示的な再計画が必要です。
      </Text>
    </View>
  );
  const footer = (
    <View
      ref={saveAreaRef}
      testID="settings-save-area"
      style={styles.saveArea}
      {...(Platform.OS === 'web'
        ? { tabIndex: -1, role: 'group' as const, 'aria-label': '設定の保存結果' }
        : {})}
    >
      {saveError ? (
        <Text style={[styles.helper, { color: colors.error }]}>保存できませんでした</Text>
      ) : Object.values(fieldErrors).some(Boolean) ? (
        <Notice tone="error" message="入力内容を確認してください。" />
      ) : saveSucceeded ? (
        <Notice tone="success" message="設定を保存しました。" />
      ) : (
        <Text accessibilityLiveRegion="polite" style={styles.helper}>
          {dirty ? '未保存の変更があります' : '変更はありません'}
        </Text>
      )}
      <ActionButton
        accessibilityLabel={isSaving ? 'プロフィール設定を保存中' : 'プロフィール設定を保存する'}
        disabled={isSaving}
        loading={isSaving}
        label={isSaving ? '保存中…' : '変更を保存'}
        onPress={() => void submit()}
      />
    </View>
  );
  const feedback = saveError ? <Notice tone="error" message={saveError} /> : null;
  return renderLayout ? (
    renderLayout(body, footer, dirty, feedback)
  ) : (
    <View>
      {body}
      {feedback}
      {footer}
    </View>
  );
}
const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  helper: { color: colors.textSecondary, ...typography.secondary },
  fieldError: { color: colors.error, ...typography.secondary },
  saveArea: {
    gap: spacing.sm,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
});
