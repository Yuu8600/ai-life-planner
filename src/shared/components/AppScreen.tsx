import type { ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/shared/theme';

type AppScreenProps = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  testID?: string;
};

export function AppScreen({
  children,
  contentContainerStyle,
  scroll = true,
  testID,
}: AppScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea} testID={testID}>
        <View style={[styles.staticContent, contentContainerStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea} testID={testID}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  staticContent: {
    flex: 1,
    ...Platform.select({ web: { width: '100%', maxWidth: 960, alignSelf: 'center' } as const }),
  },
  scrollContent: {
    flexGrow: 1,
    ...Platform.select({ web: { width: '100%', maxWidth: 960, alignSelf: 'center' } as const }),
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
