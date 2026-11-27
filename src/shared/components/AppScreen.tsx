import { useEffect, useState, type ReactNode, type Ref } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/shared/theme';

type AppScreenProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
  scrollRef?: Ref<ScrollView>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  scrollEnabled?: boolean;
  onScroll?: ScrollViewProps['onScroll'];
  testID?: string;
};

export function AppScreen({
  children,
  header,
  footer,
  overlay,
  scrollRef,
  contentContainerStyle,
  scroll = true,
  scrollEnabled,
  onScroll,
  testID,
}: AppScreenProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !footer) return;
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [footer]);

  const edges =
    footer && !keyboardOpen
      ? (['top', 'left', 'right', 'bottom'] as const)
      : (['top', 'left', 'right'] as const);

  if (!scroll) {
    return (
      <SafeAreaView edges={edges} style={styles.safeArea} testID={testID}>
        {header ? <View style={styles.header}>{header}</View> : null}
        <View style={[styles.staticContent, contentContainerStyle]}>{children}</View>
        {overlay}
        {footer}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={styles.safeArea} testID={testID}>
      {header ? <View style={styles.header}>{header}</View> : null}
      <ScrollView
        ref={scrollRef}
        scrollEnabled={scrollEnabled}
        onScroll={onScroll}
        scrollEventThrottle={onScroll ? 16 : undefined}
        alwaysBounceVertical={Platform.OS === 'ios'}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          header ? { paddingTop: 0 } : undefined,
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {overlay}
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexShrink: 0,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    ...Platform.select({ web: { width: '100%', maxWidth: 960, alignSelf: 'center' } as const }),
  },
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + spacing.xl,
  },
});
