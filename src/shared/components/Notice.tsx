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
  const [foreground, background] = {
    info: [c.primary, c.primarySoft],
    success: [c.success, c.successSoft],
    warning: [c.warning, c.warningSoft],
    error: [c.error, c.errorSoft],
  }[tone];
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{
        padding: spacing.md,
        gap: spacing.sm,
        borderLeftWidth: 3,
        borderLeftColor: foreground,
        backgroundColor: background,
        borderRadius: radius.sm,
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
        style={{ ...typography.secondary, color: foreground }}
      >
        {message}
      </Text>
      {action}
    </View>
  );
}
