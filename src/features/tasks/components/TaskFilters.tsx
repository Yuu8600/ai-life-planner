import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/shared/theme';

import type { TaskFilter } from '../types';

type TaskFiltersProps = {
  filters: TaskFilter[];
};

export function TaskFilters({ filters }: TaskFiltersProps) {
  return (
    <View accessibilityLabel="タスクのフィルター" style={styles.container}>
      {filters.map((filter, index) => {
        const selected = index === 0;

        return (
          <Pressable
            accessibilityLabel={filter.label + 'のタスクを表示'}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={filter.id}
            style={[styles.filter, selected ? styles.selectedFilter : null]}
          >
            <Text style={[styles.label, selected ? styles.selectedLabel : null]}>
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  filter: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  selectedFilter: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  selectedLabel: {
    color: colors.surface,
  },
});
