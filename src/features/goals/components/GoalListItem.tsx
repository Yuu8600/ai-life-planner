import { useState } from 'react';
import { ActionButton } from '@/shared/components/ActionButton';
import { Text, View } from 'react-native';
import { Badge } from '@/shared/components/Badge';
import { Card } from '@/shared/components/Card';
import { ItemActions } from '@/shared/components/ItemActions';
import { useTheme } from '@/shared/theme';
import type { GoalListItemModel } from '../types';

type GoalListItemProps = {
  disabled?: boolean;
  goal: GoalListItemModel;
  isDeleting?: boolean;
  isLast?: boolean;
  onDelete: () => void;
  onEdit: () => void;
};
export function GoalListItem({
  disabled = false,
  goal,
  isDeleting = false,
  onDelete,
  onEdit,
}: GoalListItemProps) {
  const { colors, spacing, typography } = useTheme();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const longDescription = Boolean(
    goal.description && (goal.description.length > 80 || goal.description.split('\n').length > 2),
  );
  return (
    <Card testID={`goal-card-${goal.id}`}>
      <Text
        style={{
          ...typography.bodyStrong,
          color: colors.textPrimary,
          flexShrink: 1,
          maxWidth: '100%',
        }}
      >
        {goal.title}
      </Text>
      <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
        期限 {goal.deadlineLabel}
      </Text>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}
      >
        <Badge
          label={goal.statusLabel}
          tone={goal.status === 'completed' ? 'success' : 'neutral'}
        />
        <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
          {goal.priorityLabel}
        </Text>
      </View>
      {goal.description ? (
        <View style={{ gap: spacing.xs }}>
          <Text
            numberOfLines={longDescription && !descriptionExpanded ? 2 : undefined}
            style={{ ...typography.secondary, color: colors.textSecondary }}
          >
            {goal.description}
          </Text>
          {longDescription ? (
            <ActionButton
              label={descriptionExpanded ? '説明を閉じる' : '説明を全文表示'}
              accessibilityLabel={`${goal.title}の説明を切り替える`}
              expanded={descriptionExpanded}
              disabled={disabled}
              onPress={() => setDescriptionExpanded((value) => !value)}
              variant="ghost"
              style={{ alignSelf: 'flex-start' }}
            />
          ) : null}
        </View>
      ) : null}
      <ItemActions
        title={goal.title}
        disabled={disabled}
        isDeleting={isDeleting}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </Card>
  );
}
