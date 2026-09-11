import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/shared/theme';

import type { ChatMessage } from '../types';

type ChatBubbleProps = {
  message: ChatMessage;
};

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      {!isUser ? <Text style={styles.sender}>AI Planner</Text> : null}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.text, isUser ? styles.userText : null]}>{message.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  assistantRow: {
    alignItems: 'flex-start',
  },
  sender: {
    marginBottom: spacing.sm,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  bubble: {
    maxWidth: '88%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  userBubble: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: radius.sm,
  },
  assistantBubble: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.sm,
  },
  text: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
  },
  userText: {
    color: colors.surface,
  },
});
