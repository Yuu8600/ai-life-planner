import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, controls, spacing, typography } from '@/shared/theme';

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
            (pressed || backAction.disabled) && { opacity: 0.55 },
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

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  compactContainer: { marginBottom: spacing.xs },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: controls.minimumTarget,
    paddingRight: spacing.md,
    marginLeft: -2,
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
