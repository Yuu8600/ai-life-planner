import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/shared/theme';

type SectionHeaderProps = {
  detail?: string;
  compact?: boolean;
  title: string;
};

export function SectionHeader({ detail, title, compact = false }: SectionHeaderProps) {
  return (
    <View style={[styles.container, compact ? { marginTop: 0, marginBottom: 0 } : null]}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    ...typography.sectionTitle,
    flexShrink: 1,
    color: colors.text,
  },
  detail: {
    color: colors.textMuted,
    ...typography.secondary,
    fontWeight: '600',
  },
});
