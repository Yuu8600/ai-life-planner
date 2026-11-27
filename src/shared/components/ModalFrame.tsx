import { useState, type ReactNode } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirmDiscardChanges } from '@/shared/feedback/confirmDiscardChanges';
import { useTheme } from '@/shared/theme';
import { ModalHeader } from './ModalHeader';
export type ModalFrameProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  visible?: boolean;
  onDismiss?: () => void;
  closeLabel?: string;
  closeDisabled?: boolean;
  dirty?: boolean;
  testID?: string;
};
export function ModalFrame({
  title,
  description,
  children,
  footer,
  onClose,
  visible = true,
  onDismiss,
  closeLabel,
  closeDisabled = false,
  dirty = false,
  testID,
}: ModalFrameProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const close = () => {
    if (closeDisabled) return;
    confirmDiscardChanges(dirty, onClose);
  };
  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      accessibilityLabel={title}
      testID={testID ? `${testID}-presentation` : undefined}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
      allowSwipeDismissal={false}
    >
      <View
        style={{ flex: 1 }}
        onLayout={({ nativeEvent }) => {
          // iPhone page sheets are bottom anchored in a separate window. Their local
          // origin is zero, while keyboard screenY is measured in screen coordinates.
          if (Platform.OS === 'ios')
            setKeyboardOffset(
              Math.max(0, Dimensions.get('screen').height - nativeEvent.layout.height),
            );
        }}
      >
        <KeyboardAvoidingView
          keyboardVerticalOffset={keyboardOffset}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: colors.surface }}
        >
          <SafeAreaView
            edges={['top', 'left', 'right', 'bottom']}
            testID={testID}
            style={{ flex: 1, backgroundColor: colors.surface }}
            accessibilityViewIsModal
            onAccessibilityEscape={close}
          >
            {Platform.OS === 'ios' ? (
              <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: radius.pill,
                    backgroundColor: colors.borderSubtle,
                  }}
                />
              </View>
            ) : null}
            <ModalHeader
              title={title}
              closeLabel={closeLabel}
              disabled={closeDisabled}
              onClose={close}
            />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
            >
              {description ? (
                <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
                  {description}
                </Text>
              ) : null}
              {children}
            </ScrollView>
            {footer ? (
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderSubtle,
                  backgroundColor: colors.surface,
                }}
              >
                {footer}
              </View>
            ) : null}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
