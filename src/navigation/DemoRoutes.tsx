import { SettingsExitControl } from '@/navigation/SettingsExitControl';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { Card } from '@/shared/components/Card';
import { colors, spacing, typography } from '@/shared/theme';
import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';

import { GoalsScreen } from '@/features/goals/GoalsScreen';
import { TasksScreen } from '@/features/tasks/TasksScreen';
import { CalendarScreen } from '@/features/calendar/CalendarScreen';
import { RuleBasedPlannerProvider } from '@/features/planner';
import { PlannerPreviewScreen } from '@/features/planner/PlannerPreviewScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { TodayScreen } from '@/features/today/TodayScreen';

import { useDemo } from '@/features/demo/DemoProvider';

/** Screen data reloads on browser navigation, just as native routes do on focus. */
function useDemoRoute() {
  const demo = useDemo();
  const [focus, setFocus] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocus((value) => value + 1);
    }, []),
  );
  return { ...demo, refreshToken: demo.revision + focus };
}

export function DemoGoalsRoute() {
  const { repositories, refreshToken } = useDemoRoute();
  return <GoalsScreen key={refreshToken} repository={repositories.goalRepository} />;
}
function DemoNextStep({
  message,
  label,
  onPress,
}: {
  message: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Card style={styles.nextStep}>
      <Text style={styles.nextStepCopy}>{message}</Text>
      <ActionButton label={label} onPress={onPress} variant="secondary" />
    </Card>
  );
}

export function DemoTasksRoute() {
  const router = useRouter();
  const { repositories, refreshToken } = useDemoRoute();
  return (
    <TasksScreen
      intro={
        <DemoNextStep
          message="タスクを確認したら、計画で使うサンプル予定を見てみましょう。"
          label="カレンダーを見る"
          onPress={() => router.navigate('/calendar')}
        />
      }
      now={repositories.now()}
      refreshToken={refreshToken}
      repository={repositories.taskRepository}
    />
  );
}
export function DemoCalendarRoute() {
  const router = useRouter();
  const { repositories, refreshToken } = useDemoRoute();
  return (
    <CalendarScreen
      intro={
        <DemoNextStep
          message="授業などのサンプル予定が入っています。空いている時間を使って計画を作れます。"
          label="計画を作りに進む"
          onPress={() => router.navigate('/ai')}
        />
      }
      sourceLabel="demo"
      eventBufferRepository={repositories.eventBufferRepository}
      calendarRepository={repositories.calendarRepository}
      settingsRepository={repositories.settingsRepository}
      refreshToken={refreshToken}
      now={repositories.now}
    />
  );
}
export function DemoTodayRoute() {
  const isFocused = useIsFocused();
  const { repositories, refreshToken } = useDemoRoute();
  const router = useRouter();
  const openPlanner = (mode: 'generate' | 'replan') =>
    router.push({ pathname: '/ai', params: { mode, entry: String(Date.now()) } });
  return (
    <TodayScreen
      isFocused={isFocused}
      now={repositories.now}
      settingsRepository={repositories.settingsRepository}
      eventBufferRepository={repositories.eventBufferRepository}
      calendarRepository={repositories.calendarRepository}
      repository={repositories.todayRepository}
      executionRepository={repositories.executionRepository}
      activityLogRepository={repositories.activityLogRepository}
      refreshToken={refreshToken}
      onPressAi={() => openPlanner('generate')}
      onPressReplan={() => openPlanner('replan')}
      replanHint="予定を完了・スキップしたあと、再計画で残り時間の予定を組み直せます。"
      onPressSettings={() => router.push('/settings')}
    />
  );
}
const ruleBasedProvider = new RuleBasedPlannerProvider();
export function DemoPlannerRoute() {
  const { repositories, refreshToken } = useDemoRoute();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; entry?: string }>();
  const mode = params.mode === 'replan' ? 'replan' : 'generate';
  const returnToToday = () => {
    router.setParams({ mode: undefined, entry: undefined });
    router.navigate('/today');
  };
  return (
    <PlannerPreviewScreen
      isDemo
      key={`${mode}-${params.entry ?? ''}`}
      mode={mode}
      provider={ruleBasedProvider}
      eventBufferRepository={repositories.eventBufferRepository}
      calendarRepository={repositories.calendarRepository}
      settingsRepository={repositories.settingsRepository}
      goalRepository={repositories.goalRepository}
      taskRepository={repositories.taskRepository}
      persistenceRepository={repositories.persistenceRepository}
      replanRepository={repositories.replanRepository}
      refreshToken={refreshToken}
      now={repositories.now}
      onPressToday={returnToToday}
      onReplanSaved={returnToToday}
      onCancelReplan={returnToToday}
    />
  );
}
export function DemoSettingsRoute() {
  const { repositories } = useDemo();
  const router = useRouter();
  return (
    <SettingsScreen
      CloseControl={SettingsExitControl}
      repository={repositories.settingsRepository}
      onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      sections={[
        {
          id: 'demo',
          title: 'デモの計画設定',
          items: [
            {
              id: 'calendar',
              label: 'カレンダー',
              value: 'サンプル予定',
              detail:
                'サンプル時計・予定の時刻は東京基準です。表示と空き時間は設定したtimezoneで計算します。',
            },
            {
              id: 'storage',
              label: '保存先',
              value: 'このタブのメモリ',
              detail: '再読み込み・リセットで初期状態に戻ります。',
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  nextStep: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  nextStepCopy: { ...typography.body, color: colors.textSecondary, flexBasis: 300, flexGrow: 1 },
});
