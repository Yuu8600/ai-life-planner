import { ActionButton } from '@/shared/components/ActionButton';
import { Card } from '@/shared/components/Card';
import { appAlert } from '@/shared/feedback/appAlert';
import { useEffect, useRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { colors, spacing } from '@/shared/theme';

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

  const bodyScroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (!saveError) return;
    const frame = requestAnimationFrame(() => bodyScroll.current?.scrollToEnd({ animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [saveError]);
  const layout = (body: ReactNode, footer?: ReactNode, dirty = false, feedback?: ReactNode) => {
    const close = () => {
      if (isSaving) return;
      if (dirty)
        appAlert.alert('変更を破棄しますか？', '保存していない設定の変更は失われます。', [
          { text: '編集を続ける', style: 'cancel' },
          { text: '変更を破棄', style: 'destructive', onPress: onPressBack },
        ]);
      else onPressBack();
    };
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <AppScreen
          testID="settings-screen"
          contentContainerStyle={styles.content}
          footer={footer}
          scrollRef={bodyScroll}
        >
          <ScreenHeader
            title="設定"
            action={
              <ActionButton
                accessibilityLabel="設定を閉じる"
                label="閉じる"
                variant="ghost"
                disabled={isSaving}
                onPress={close}
              />
            }
          />
          {body}
          {sections.map((section) => (
            <Card key={section.id}>
              <SectionHeader compact title={section.title} />
              {section.items.map((item, index) => (
                <SettingRow key={item.id} item={item} isLast={index === section.items.length - 1} />
              ))}
            </Card>
          ))}
          {accountSection}
          {feedback}
        </AppScreen>
      </KeyboardAvoidingView>
    );
  };
  if (isLoading)
    return layout(
      <SettingsStatePanel
        isLoading
        message="保存した計画の基本設定を読み込んでいます。"
        testID="settings-loading-state"
        title="読み込み中"
      />,
    );
  if (loadError)
    return layout(
      <SettingsStatePanel
        actionLabel={repository ? '再読み込み' : undefined}
        message={loadError}
        onPressAction={repository ? retry : undefined}
        testID="settings-error-state"
        title={repository ? 'プロフィール設定を読み込めませんでした' : 'ログインが必要です'}
      />,
    );
  return settings ? (
    <PlanningSettingsForm
      clearSaveFeedback={clearSaveFeedback}
      isSaving={isSaving}
      onSubmit={save}
      saveError={saveError}
      saveSucceeded={saveSucceeded}
      settings={settings}
      renderLayout={layout}
    />
  ) : (
    layout(null)
  );
}
const styles = StyleSheet.create({
  keyboardView: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: spacing.lg },
});
