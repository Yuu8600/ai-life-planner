import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/shared/theme';

type SectionHeaderProps = {
  detail?: string;
  title: string;
};

export function SectionHeader({ detail, title }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
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
    fontSize: 13,
    fontWeight: '600',
  },
});
