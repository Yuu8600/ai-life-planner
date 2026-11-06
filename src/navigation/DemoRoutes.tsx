import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

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
export function DemoTasksRoute() {
  const { repositories, refreshToken } = useDemoRoute();
  return (
    <TasksScreen
      now={repositories.now()}
      refreshToken={refreshToken}
      repository={repositories.taskRepository}
    />
  );
}
export function DemoCalendarRoute() {
  const { repositories, refreshToken } = useDemoRoute();
  return (
    <CalendarScreen
      sourceLabel="demo"
      calendarRepository={repositories.calendarRepository}
      settingsRepository={repositories.settingsRepository}
      refreshToken={refreshToken}
      now={repositories.now}
    />
  );
}
export function DemoTodayRoute() {
  const { repositories, refreshToken } = useDemoRoute();
  const router = useRouter();
  const openPlanner = (mode: 'generate' | 'replan') =>
    router.push({ pathname: '/ai', params: { mode, entry: String(Date.now()) } });
  return (
    <TodayScreen
      repository={repositories.todayRepository}
      executionRepository={repositories.executionRepository}
      activityLogRepository={repositories.activityLogRepository}
      refreshToken={refreshToken}
      onPressAi={() => openPlanner('generate')}
      onPressReplan={() => openPlanner('replan')}
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
      key={`${mode}-${params.entry ?? ''}`}
      mode={mode}
      provider={ruleBasedProvider}
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
