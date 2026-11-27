import type { ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';

export function Card({
  children,
  style,
  testID,
  variant = 'elevated',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant?: 'elevated' | 'flat' | 'tinted';
}) {
  const { colors, radius, spacing } = useTheme();
  const elevatedShadow =
    variant === 'elevated'
      ? Platform.select({
          ios: {
            shadowColor: colors.shadow,
            shadowOpacity: 0.055,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 4 },
          },
          android: { elevation: 2 },
          web: { boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05)' } as ViewStyle,
        })
      : undefined;

  return (
    <View
      testID={testID}
      style={[
        {
          minWidth: 0,
          padding: spacing.lg,
          gap: spacing.md,
          backgroundColor: variant === 'tinted' ? colors.surfaceSubtle : colors.surface,
          borderWidth: 1,
          borderColor: variant === 'tinted' ? 'transparent' : colors.borderSubtle,
          borderRadius: radius.card,
        },
        elevatedShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}
