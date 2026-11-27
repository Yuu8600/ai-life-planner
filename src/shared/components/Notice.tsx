import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';
export type NoticeTone = 'info' | 'success' | 'warning' | 'error';
export function Notice({
  title,
  message,
  tone = 'info',
  action,
  testID,
}: {
  title?: string;
  message: string;
  tone?: NoticeTone;
  action?: ReactNode;
  testID?: string;
}) {
  const { colors: c, radius, spacing, typography } = useTheme();
  const [foreground, background, border] = {
    info: [c.primary, c.primarySoft, 'rgba(79, 70, 229, 0.18)'],
    success: [c.success, c.successSoft, 'rgba(4, 120, 87, 0.18)'],
    warning: [c.warning, c.warningSoft, 'rgba(146, 64, 14, 0.18)'],
    error: [c.error, c.errorSoft, 'rgba(185, 28, 28, 0.18)'],
  }[tone];
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: background,
        borderRadius: radius.md,
        minWidth: 0,
      }}
    >
      {title ? (
        <Text accessibilityRole="header" style={{ ...typography.label, color: foreground }}>
          {title}
        </Text>
      ) : null}
      <Text
        accessibilityRole={tone === 'error' ? 'alert' : undefined}
        style={{ ...typography.secondary, color: foreground, fontWeight: '500' }}
      >
        {message}
      </Text>
      {action}
    </View>
  );
}
