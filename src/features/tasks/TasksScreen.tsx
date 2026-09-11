import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { colors, radius, spacing } from '@/shared/theme';

import { TaskFilters } from './components/TaskFilters';
import { TaskListItem } from './components/TaskListItem';
import { TASK_FILTERS, TASKS } from './data';

export function TasksScreen() {
  return (
    <AppScreen testID="tasks-screen">
      <ScreenHeader
        subtitle="目標につながる次の行動を、所要時間と一緒に確認します。"
        title="タスク"
      />

      <TaskFilters filters={TASK_FILTERS} />

      <View style={styles.list}>
        {TASKS.map((task, index) => (
          <TaskListItem isLast={index === TASKS.length - 1} key={task.id} task={task} />
        ))}
      </View>

      <ActionButton label="＋ タスクを追加" style={styles.addButton} variant="secondary" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  addButton: {
    marginTop: spacing.lg,
  },
});
