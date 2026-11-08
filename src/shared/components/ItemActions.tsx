import { useState } from 'react';
import { View } from 'react-native';
import { ActionButton } from './ActionButton';
import { useTheme } from '@/shared/theme';

/** Inline disclosure: deletion remains a separate, explicitly confirmed action. */
export function ItemActions({
  title,
  disabled = false,
  isDeleting = false,
  onEdit,
  onDelete,
}: {
  title: string;
  disabled?: boolean;
  isDeleting?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { spacing } = useTheme();
  const blocked = disabled || isDeleting;
  return (
    <View style={{ gap: spacing.sm, minWidth: 0, maxWidth: '100%', flexShrink: 1 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <ActionButton
          label="編集"
          accessibilityLabel={`${title}を編集する`}
          disabled={blocked}
          onPress={onEdit}
          variant="ghost"
        />
        <ActionButton
          label={expanded ? 'その他を閉じる' : 'その他'}
          accessibilityLabel={`${title}のその他の操作`}
          expanded={expanded}
          disabled={blocked}
          onPress={() => setExpanded((value) => !value)}
          variant="ghost"
        />
      </View>
      {expanded ? (
        <ActionButton
          label={isDeleting ? '削除中…' : '削除する'}
          accessibilityLabel={`${title}を削除する`}
          disabled={blocked}
          loading={isDeleting}
          onPress={onDelete}
          variant="destructive"
          style={{ alignSelf: 'flex-start' }}
        />
      ) : null}
    </View>
  );
}
