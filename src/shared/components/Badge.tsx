import { Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';
export type BadgeTone = 'accent' | 'info' | 'neutral' | 'success' | 'warning' | 'error';
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const { colors: c, spacing, radius, typography } = useTheme();
  const [foreground, background] = {
    accent: [c.primary, c.primarySoft],
    info: [c.primary, c.primarySoft],
    neutral: [c.calendar, c.calendarSoft],
    success: [c.success, c.successSoft],
    warning: [c.warning, c.warningSoft],
    error: [c.error, c.errorSoft],
  }[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        maxWidth: '100%',
        flexShrink: 1,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.sm,
        backgroundColor: background,
      }}
    >
      <Text style={{ ...typography.label, color: foreground, flexShrink: 1 }}>{label}</Text>
    </View>
  );
}
