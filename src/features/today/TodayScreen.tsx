import { Pressable, StyleSheet, Text } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { colors, radius, spacing } from '@/shared/theme';

import { formatTodayDateLabel, toTimelineItems } from './presentation';
import type { TodayRepository } from './repositories/TodayRepository';
import { useToday } from './useToday';
import { PlanSummary } from './components/PlanSummary';
import { Timeline } from './components/Timeline';
import { TodayStatePanel } from './components/TodayStatePanel';

type TodayScreenProps = {
  onPressAi: () => void;
  onPressSettings: () => void;
  refreshToken?: number;
  repository: TodayRepository | null;
};

export function TodayScreen({
  onPressAi,
  onPressSettings,
  refreshToken = 0,
  repository,
}: TodayScreenProps) {
  const { isLoading, loadError, retry, today } = useToday(repository, refreshToken);
  const timelineItems = today ? toTimelineItems(today) : [];
  const completedActions = today?.actions.filter((action) => action.status === 'completed').length;

  return (
    <AppScreen testID="today-screen">
      <ScreenHeader
        action={
          <Pressable
            accessibilityLabel="設定を開く"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onPressSettings}
            style={({ pressed }) => [styles.settingsButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        }
        eyebrow={today ? formatTodayDateLabel(today.localDate) : undefined}
        subtitle="今日も、使える時間から始めましょう。"
        title={today?.greeting ?? '今日の予定'}
      />

      {isLoading ? (
        <TodayStatePanel
          isLoading
          message="Supabaseから今日の予定を取得しています。"
          testID="today-loading-state"
          title="読み込み中"
        />
      ) : loadError ? (
        <TodayStatePanel
          actionLabel={repository ? '再読み込み' : undefined}
          message={loadError}
          onPressAction={repository ? retry : undefined}
          testID="today-error-state"
          title={repository ? '今日の予定を読み込めませんでした' : 'ログインが必要です'}
        />
      ) : today && today.actions.length === 0 ? (
        <>
          <SectionHeader detail="実行予定のAction" title="今日のタイムライン" />
          <TodayStatePanel
            message="今日実行する予定はまだありません。"
            testID="today-empty-state"
            title="今日の予定はありません"
          />
        </>
      ) : today ? (
        <>
          <PlanSummary
            completedActions={completedActions ?? 0}
            summary={today.summary ?? '今日の実行予定を確認しましょう。'}
            totalActions={today.actions.length}
          />

          <SectionHeader detail="実行予定のAction" title="今日のタイムライン" />
          <Timeline items={timelineItems} />
        </>
      ) : null}

      <ActionButton
        accessibilityLabel="AIに今日の計画を相談する"
        label="AIに相談する"
        onPress={onPressAi}
        style={styles.aiButton}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  settingsIcon: {
    color: colors.text,
    fontSize: 20,
  },
  pressed: {
    opacity: 0.7,
  },
  aiButton: {
    marginTop: spacing.xl,
  },
});
