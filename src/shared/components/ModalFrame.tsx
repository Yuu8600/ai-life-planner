import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/theme';
import { ModalHeader } from './ModalHeader';
export type ModalFrameProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  closeDisabled?: boolean;
  testID?: string;
};
export function ModalFrame({
  title,
  description,
  children,
  footer,
  onClose,
  closeLabel,
  closeDisabled = false,
  testID,
}: ModalFrameProps) {
  const { colors, spacing, typography } = useTheme();
  const close = () => {
    if (!closeDisabled) onClose();
  };
  return (
    <Modal
      visible
      accessibilityLabel={title}
      testID={testID ? `${testID}-presentation` : undefined}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
      allowSwipeDismissal={false}
    >
      <KeyboardAvoidingView
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
                padding: spacing.lg,
                borderTopWidth: 1,
                borderTopColor: colors.borderSubtle,
              }}
            >
              {footer}
            </View>
          ) : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
