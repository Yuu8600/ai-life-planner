import { useContext, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/shared/theme';
export type PanelAnchor = { x: number; y: number; width: number; height: number };
export type SelectionPanelProps = {
  title: string;
  anchor: PanelAnchor;
  onCancel: () => void;
  children: ReactNode;
};
export function SelectionPanel({ title, onCancel, children }: SelectionPanelProps) {
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
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
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' },
  panel: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  content: { gap: spacing.md },
});
