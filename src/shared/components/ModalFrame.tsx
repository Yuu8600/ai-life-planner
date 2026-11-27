import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appAlert } from '@/shared/feedback/appAlert';
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
  dirty?: boolean;
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
  dirty = false,
  testID,
}: ModalFrameProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const close = () => {
    if (closeDisabled) return;
    if (!dirty) {
      onClose();
      return;
    }
    appAlert.alert('変更を破棄しますか？', '保存していない入力内容は失われます。', [
      { text: '編集を続ける', style: 'cancel' },
      { text: '変更を破棄', style: 'destructive', onPress: onClose },
    ]);
  };
  return (
    <Modal
      visible
      accessibilityLabel={title}
      testID={testID ? `${testID}-presentation` : undefined}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' && dirty ? 'fullScreen' : 'pageSheet'}
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
          {Platform.OS === 'ios' && !dirty ? (
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
    </Modal>
  );
}
