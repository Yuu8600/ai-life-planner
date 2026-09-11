import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/shared/theme';

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  detail: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
