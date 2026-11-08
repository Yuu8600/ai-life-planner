import { useContext, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/theme';
import { ModalHeader } from '../ModalHeader';
export type PanelAnchor = { x: number; y: number; width: number; height: number };
export type SelectionPanelProps = {
  title: string;
  anchor: PanelAnchor;
  onCancel: () => void;
  children: ReactNode;
};
export function SelectionPanel({ title, onCancel, children }: SelectionPanelProps) {
  const { colors, radius, spacing } = useTheme();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}をキャンセルして閉じる`}
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={onCancel}
          testID="selection-panel"
          style={{
            maxHeight: '85%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.dialog,
            borderTopRightRadius: radius.dialog,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          }}
        >
          <ModalHeader title={title} onClose={onCancel} closeLabel={`${title}のパネルを閉じる`} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
