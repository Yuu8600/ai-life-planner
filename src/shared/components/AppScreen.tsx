import type { ReactNode, Ref } from 'react';
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
  footer?: ReactNode;
  scrollRef?: Ref<ScrollView>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  testID?: string;
};

export function AppScreen({
  children,
  footer,
  scrollRef,
  contentContainerStyle,
  scroll = true,
  testID,
}: AppScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView
        edges={footer ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}
        style={styles.safeArea}
        testID={testID}
      >
        <View style={[styles.staticContent, contentContainerStyle]}>{children}</View>
        {footer}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={footer ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}
      style={styles.safeArea}
      testID={testID}
    >
      <ScrollView
        ref={scrollRef}
        style={footer ? { flex: 1 } : undefined}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer}
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
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
