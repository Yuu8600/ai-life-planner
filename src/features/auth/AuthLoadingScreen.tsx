import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/shared/theme';

export function AuthLoadingScreen() {
  return (
    <SafeAreaView style={styles.safeArea} testID="auth-loading-screen">
      <View
        accessibilityLiveRegion="polite"
        accessibilityState={{ busy: true }}
        {...(Platform.OS === 'web' ? { 'aria-busy': true } : {})}
        style={styles.content}
      >
        <ActivityIndicator
          accessibilityLabel="認証状態を確認中"
          color={colors.accent}
          size="small"
        />
        <Text style={styles.message}>アプリを準備しています…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  message: {
    color: colors.textMuted,
    ...typography.body,
  },
});
