import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { colors, radius, spacing } from '@/shared/theme';

import { SettingRow } from './components/SettingRow';
import { PlanningSettingsForm } from './components/PlanningSettingsForm';
import { SettingsStatePanel } from './components/SettingsStatePanel';
import { SETTING_SECTIONS } from './data';
import type { SettingsRepository } from './repositories/SettingsRepository';
import { usePlanningSettings } from './usePlanningSettings';

type SettingsScreenProps = {
  accountSection?: ReactNode;
  sections?: typeof SETTING_SECTIONS;
  onPressBack: () => void;
  repository: SettingsRepository | null;
};

export function SettingsScreen({
  accountSection,
  sections = SETTING_SECTIONS,
  onPressBack,
  repository,
}: SettingsScreenProps) {
  const {
    clearSaveFeedback,
    isLoading,
    isSaving,
    loadError,
    retry,
    save,
    saveError,
    saveSucceeded,
    settings,
  } = usePlanningSettings(repository);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <AppScreen testID="settings-screen">
        <ScreenHeader
          action={
            <Pressable
              accessibilityLabel="設定を閉じる"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onPressBack}
              style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.closeIcon}>×</Text>
            </Pressable>
          }
          subtitle="暮らしに合わせて、計画の前提を整えます。"
          title="設定"
        />

        <View>
          <SectionHeader title="一日の基本設定" />
          {isLoading ? (
            <SettingsStatePanel
              isLoading
              message="保存した計画の基本設定を読み込んでいます。"
              testID="settings-loading-state"
              title="読み込み中"
            />
          ) : loadError ? (
            <SettingsStatePanel
              actionLabel={repository ? '再読み込み' : undefined}
              message={loadError}
              onPressAction={repository ? retry : undefined}
              testID="settings-error-state"
              title={repository ? 'プロフィール設定を読み込めませんでした' : 'ログインが必要です'}
            />
          ) : settings ? (
            <PlanningSettingsForm
              clearSaveFeedback={clearSaveFeedback}
              isSaving={isSaving}
              key={`${settings.timezone}:${settings.planningStart}:${settings.planningEnd}:${settings.planningEndDayOffset}:${settings.minimumFreeMinutes}:${settings.calendarBufferBeforeMinutes}:${settings.calendarBufferAfterMinutes}`}
              onSubmit={save}
              saveError={saveError}
              saveSucceeded={saveSucceeded}
              settings={settings}
            />
          ) : null}
        </View>

        {sections.map((section) => (
          <View key={section.id}>
            <SectionHeader title={section.title} />
            <View style={styles.list}>
              {section.items.map((item, index) => (
                <SettingRow isLast={index === section.items.length - 1} item={item} key={item.id} />
              ))}
            </View>
          </View>
        ))}

        {accountSection}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1, backgroundColor: colors.background },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  closeIcon: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 27,
  },
  pressed: {
    opacity: 0.7,
  },
  list: {
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
});
