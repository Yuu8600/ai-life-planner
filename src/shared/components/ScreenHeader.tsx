import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, spacing, typography } from '@/shared/theme';

type ScreenHeaderProps = {
  action?: ReactNode;
  compact?: boolean;
  eyebrow?: string;
  subtitle?: string;
  title: string;
};

export function ScreenHeader({
  action,
  compact = false,
  eyebrow,
  subtitle,
  title,
}: ScreenHeaderProps) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <View key={fontScale} style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, compact && styles.compactSubtitle]}>{subtitle}</Text>
        ) : null}
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
  compactContainer: { marginBottom: spacing.xs },
  copy: {
    flex: 1,
  },
  eyebrow: {
    marginBottom: spacing.xs,
    color: colors.textMuted,
    ...typography.secondary,
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
  compactSubtitle: { marginTop: spacing.xs },
  action: {
    paddingTop: spacing.xs,
  },
});
