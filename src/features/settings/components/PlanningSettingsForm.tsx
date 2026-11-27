import type { ReactNode } from 'react';
import { TimeZonePresets } from './TimeZonePresets';
import { PlannerGapSettings } from './PlannerGapSettings';
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
  advancedSettings?: ReactNode;
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
  advancedSettings,
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
  const [showPlanner, setShowPlanner] = useState(false);
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
    if (isSaving || submitLock.current || !dirty) return;

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

  const plannerFields = (
    <>
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
      {values.taskGapMinutes !== undefined ? (
        <PlannerGapSettings
          value={values.taskGapMinutes}
          disabled={isSaving}
          error={fieldErrors.taskGapMinutes}
          onChange={(value) => updateValue('taskGapMinutes', value)}
        />
      ) : null}
    </>
  );
  const plannerTip = (
    <Text style={styles.helper}>
      保存済みの計画は自動変更されません。反映には明示的な再計画が必要です。
    </Text>
  );
  const deviceTimeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      return '';
    }
  })();
  const regionFields = (
    <Card>
      <SectionHeader compact title="地域・時間帯" />
      <TimeZonePresets
        value={values.timezone}
        disabled={isSaving}
        onChange={(value) => updateValue('timezone', value)}
      />
      <Text style={styles.helper}>
        タイムゾーンを変えると「今日」の日付や日付の切り替わりが変わる場合があります。保存済みの計画は自動変更されません。
      </Text>
      <FormField error={fieldErrors.timezone} helper="例：日本は Asia/Tokyo" label="タイムゾーン">
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
      {deviceTimeZone && deviceTimeZone !== values.timezone.trim() ? (
        <ActionButton
          label={`端末のタイムゾーンを使う（${deviceTimeZone}）`}
          variant="ghost"
          disabled={isSaving}
          onPress={() => updateValue('timezone', deviceTimeZone)}
        />
      ) : null}
    </Card>
  );
  const body = (
    <View style={styles.form} testID="planning-settings-form">
      {advancedSettings || values.taskGapMinutes !== undefined ? (
        <>
          {regionFields}
          <ActionButton
            label={showPlanner ? '時間割専用の設定を閉じる' : '時間割専用の設定を表示'}
            variant="secondary"
            expanded={showPlanner}
            disabled={isSaving}
            onPress={() => setShowPlanner(!showPlanner)}
          />
          {showPlanner ? (
            <>
              {plannerFields}
              {advancedSettings}
              {plannerTip}
            </>
          ) : null}
        </>
      ) : (
        <>
          {plannerFields}
          {regionFields}
          {plannerTip}
        </>
      )}
    </View>
  );
  const footer =
    !dirty && !saveError && !Object.values(fieldErrors).some(Boolean) ? (
      saveSucceeded ? (
        <View style={styles.saveArea}>
          <Text accessibilityLiveRegion="polite" style={[styles.helper, { color: colors.success }]}>
            設定を保存しました。
          </Text>
        </View>
      ) : null
    ) : (
      <View
        ref={saveAreaRef}
        testID="settings-save-area"
        style={styles.saveArea}
        {...(Platform.OS === 'web'
          ? { tabIndex: -1, role: 'group' as const, 'aria-label': '設定の保存結果' }
          : {})}
      >
        <View style={styles.statusSlot}>
          {saveError ? (
            <Text
              accessibilityRole="alert"
              style={[styles.helper, { color: colors.error, fontWeight: '600' }]}
            >
              保存できませんでした
            </Text>
          ) : Object.values(fieldErrors).some(Boolean) ? (
            <Text
              accessibilityRole="alert"
              style={[styles.helper, { color: colors.error, fontWeight: '600' }]}
            >
              入力内容を確認してください。
            </Text>
          ) : saveSucceeded ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.helper, { color: colors.success, fontWeight: '600' }]}
            >
              設定を保存しました。
            </Text>
          ) : (
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.helper, dirty && { color: colors.primary, fontWeight: '600' }]}
            >
              {dirty ? '未保存の変更があります' : '変更はありません'}
            </Text>
          )}
        </View>
        <ActionButton
          accessibilityLabel={isSaving ? 'プロフィール設定を保存中' : 'プロフィール設定を保存する'}
          disabled={isSaving || !dirty}
          loading={isSaving}
          label={isSaving ? '保存中…' : '変更を保存'}
          variant={dirty ? 'primary' : 'secondary'}
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
  statusSlot: { minHeight: 24, justifyContent: 'center' },
  fieldError: { color: colors.error, ...typography.secondary },
  saveArea: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
});
