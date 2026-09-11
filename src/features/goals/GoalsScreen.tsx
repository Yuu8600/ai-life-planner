import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { colors, radius, spacing } from '@/shared/theme';

import { GoalListItem } from './components/GoalListItem';
import { GOALS } from './data';

export function GoalsScreen() {
  return (
    <AppScreen testID="goals-screen">
      <ScreenHeader subtitle="目指す状態と、いまの進捗をまとめて確認します。" title="目標" />

      <View style={styles.list}>
        {GOALS.map((goal, index) => (
          <GoalListItem goal={goal} isLast={index === GOALS.length - 1} key={goal.id} />
        ))}
      </View>

      <ActionButton label="＋ 新しい目標" style={styles.addButton} variant="secondary" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: spacing.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  addButton: {
    marginTop: spacing.lg,
  },
});
