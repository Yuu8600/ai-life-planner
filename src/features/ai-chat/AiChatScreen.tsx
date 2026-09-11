import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { colors, radius, spacing } from '@/shared/theme';

import { ChatBubble } from './components/ChatBubble';
import { ChangeProposal } from './components/ChangeProposal';
import { DUMMY_CONVERSATION } from './data';

export function AiChatScreen() {
  return (
    <AppScreen contentContainerStyle={styles.screen} scroll={false} testID="ai-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardArea}
      >
        <View style={styles.header}>
          <ScreenHeader
            subtitle="予定の変化を伝えると、無理のない調整案を考えます。"
            title="AI Planner"
          />
        </View>
        <ScrollView
          contentContainerStyle={styles.conversation}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ChatBubble message={DUMMY_CONVERSATION[0]} />
          <ChatBubble message={DUMMY_CONVERSATION[1]} />
          <ChangeProposal />
        </ScrollView>
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="AIへのメッセージ"
            multiline
            placeholder="予定の変更や相談を入力"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
          />
          <View
            accessibilityLabel="メッセージを送信"
            accessibilityRole="button"
            style={styles.sendButton}
          >
            <View style={styles.sendArrow} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
  },
  keyboardArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  conversation: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 104,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    color: colors.text,
    backgroundColor: colors.background,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  sendArrow: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 9,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.surface,
  },
});
