import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { controls, radius, spacing, typography, useThemeColors } from '@/shared/theme';

export type ScreenHeaderBackAction = {
  accessibilityLabel?: string;
  disabled?: boolean;
  label?: string;
  onPress: () => void;
};

type ScreenHeaderProps = {
  action?: ReactNode;
  backAction?: ScreenHeaderBackAction;
  compact?: boolean;
  eyebrow?: string;
  subtitle?: string;
  title: string;
};

export function ScreenHeader({
  action,
  backAction,
  compact = false,
  eyebrow,
  subtitle,
  title,
}: ScreenHeaderProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const { fontScale } = useWindowDimensions();
  return (
    <View style={[styles.wrapper, compact && styles.compactContainer]}>
      {backAction ? (
        <Pressable
          accessibilityLabel={backAction.accessibilityLabel ?? backAction.label ?? '戻る'}
          accessibilityRole="button"
          accessibilityState={{ disabled: backAction.disabled === true }}
          disabled={backAction.disabled}
          onPress={backAction.onPress}
          style={({ pressed }) => [
            styles.backButton,
            pressed && !backAction.disabled && { backgroundColor: colors.primarySoft },
            backAction.disabled && { opacity: 0.45 },
          ]}
        >
          <Text style={styles.backChevron} accessible={false}>
            ‹
          </Text>
          <Text style={styles.backLabel}>{backAction.label ?? '戻る'}</Text>
        </Pressable>
      ) : null}
      <View style={styles.container}>
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
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    wrapper: {
      marginBottom: spacing.md,
      gap: spacing.xs,
    },
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    compactContainer: { marginBottom: spacing.xs },
    backButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: controls.minimumTarget,
      paddingHorizontal: spacing.sm,
      marginLeft: -spacing.sm,
      borderRadius: radius.pill,
    },
    backChevron: {
      color: colors.primary,
      fontSize: 24,
      lineHeight: 26,
      fontWeight: '500',
    },
    backLabel: {
      ...typography.button,
      color: colors.primary,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    eyebrow: {
      marginBottom: 2,
      color: colors.textSecondary,
      ...typography.caption,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    title: {
      ...typography.screenTitle,
      color: colors.textPrimary,
      letterSpacing: -0.6,
    },
    subtitle: {
      ...typography.secondary,
      marginTop: spacing.xs,
      color: colors.textSecondary,
    },
    compactSubtitle: { marginTop: 2 },
    action: {
      justifyContent: 'center',
    },
  });
