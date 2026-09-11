import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/shared/theme';

type BadgeProps = {
  label: string;
  tone?: 'accent' | 'neutral' | 'warning';
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const labelStyle = {
    accent: styles.accentLabel,
    neutral: styles.neutralLabel,
    warning: styles.warningLabel,
  }[tone];

  return (
    <View style={[styles.badge, styles[tone]]}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  accent: {
    backgroundColor: colors.accentSoft,
  },
  neutral: {
    backgroundColor: colors.calendarSoft,
  },
  warning: {
    backgroundColor: colors.warningSoft,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  accentLabel: {
    color: colors.accent,
  },
  neutralLabel: {
    color: colors.calendar,
  },
  warningLabel: {
    color: colors.warning,
  },
});
