import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/shared/theme';

import type { TaskFilter } from '../types';

type TaskFiltersProps = {
  activeFilter: TaskFilter['id'];
  filters: readonly TaskFilter[];
  onChange: (filter: TaskFilter['id']) => void;
};

export function TaskFilters({ activeFilter, filters, onChange }: TaskFiltersProps) {
  const [focused, setFocused] = useState<string | null>(null);
  return (
    <View accessibilityLabel="タスクのフィルター" style={styles.container}>
      {filters.map((filter) => {
        const selected = filter.id === activeFilter;

        return (
          <Pressable
            {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
            accessibilityLabel={filter.label + 'のタスクを表示'}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={filter.id}
            onPress={() => onChange(filter.id)}
            onFocus={() => setFocused(filter.id)}
            onBlur={() => setFocused(null)}
            style={({ pressed }) => [
              styles.filter,
              pressed ? { backgroundColor: colors.primarySoft } : null,
              selected ? styles.selectedFilter : null,
              focused === filter.id
                ? Platform.select({
                    web: {
                      outlineColor: colors.focusRing,
                      outlineWidth: 2,
                      outlineStyle: 'solid',
                      outlineOffset: 2,
                    },
                    default: { borderColor: colors.focusRing, borderWidth: 2 },
                  })
                : null,
            ]}
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
    marginTop: spacing.sm,
  },
  filter: {
    minHeight: 44,
    maxWidth: '100%',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderControl,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  selectedFilter: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  label: {
    color: colors.textMuted,
    ...typography.label,
  },
  selectedLabel: {
    color: colors.surface,
  },
});
