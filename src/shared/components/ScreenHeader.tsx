import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/shared/theme';

type ScreenHeaderProps = {
  action?: ReactNode;
  eyebrow?: string;
  subtitle?: string;
  title: string;
};

export function ScreenHeader({ action, eyebrow, subtitle, title }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  copy: {
    flex: 1,
  },
  eyebrow: {
    marginBottom: spacing.xs,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    ...typography.screenTitle,
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.sm,
    color: colors.textMuted,
  },
  action: {
    paddingTop: spacing.xs,
  },
});
