import { Pressable, StyleSheet, Text } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { colors, radius, spacing } from '@/shared/theme';

import { TODAY_PLAN, TODAY_TIMELINE } from './data';
import { PlanSummary } from './components/PlanSummary';
import { Timeline } from './components/Timeline';

type TodayScreenProps = {
  onPressAi: () => void;
  onPressSettings: () => void;
};

export function TodayScreen({ onPressAi, onPressSettings }: TodayScreenProps) {
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
        eyebrow={TODAY_PLAN.dateLabel}
        subtitle="今日も、使える時間から始めましょう。"
        title={TODAY_PLAN.greeting}
      />

      <PlanSummary
        completedActions={TODAY_PLAN.completedActions}
        summary={TODAY_PLAN.summary}
        totalActions={TODAY_PLAN.totalActions}
      />

      <SectionHeader detail="固定予定とAIプラン" title="今日のタイムライン" />
      <Timeline items={TODAY_TIMELINE} />

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
