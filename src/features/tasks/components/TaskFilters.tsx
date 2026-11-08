import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/shared/theme';

import type { TaskFilter } from '../types';

type TaskFiltersProps = {
  activeFilter: TaskFilter['id'];
  filters: readonly TaskFilter[];
  onChange: (filter: TaskFilter['id']) => void;
};

export function TaskFilters({ activeFilter, filters, onChange }: TaskFiltersProps) {
  return (
    <View accessibilityLabel="タスクのフィルター" style={styles.container}>
      {filters.map((filter) => {
        const selected = filter.id === activeFilter;

        return (
          <Pressable
            accessibilityLabel={filter.label + 'のタスクを表示'}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={filter.id}
            onPress={() => onChange(filter.id)}
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
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  filter: {
    minHeight: 44,
    maxWidth: '100%',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
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
