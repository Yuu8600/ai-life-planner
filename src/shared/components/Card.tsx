import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';
export function Card({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          minWidth: 0,
          padding: spacing.lg,
          gap: spacing.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          borderRadius: radius.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
