import { useState } from 'react';
import { ActionButton } from '@/shared/components/ActionButton';
import { Platform, Text, View } from 'react-native';
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
  const { colors, spacing, typography, radius } = useTheme();
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
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'baseline' }}
      >
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            minWidth: 0,
            flexGrow: 1,
          }}
        >
          <Text
            style={{
              ...typography.body,
              color: colors.textPrimary,
              flexShrink: 1,
              maxWidth: '100%',
            }}
          >
            {goal.currentValueLabel}
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary }}> / </Text>
          <Text
            style={{
              ...typography.bodyStrong,
              color: colors.textPrimary,
              flexShrink: 1,
              maxWidth: '100%',
            }}
          >
            {goal.targetValueLabel}
          </Text>
        </View>
        <Text
          style={{
            ...typography.sectionTitle,
            color: goal.status === 'completed' ? colors.success : colors.primary,
          }}
        >
          {goal.progress === null ? '進捗 未設定' : `${goal.progress}%`}
        </Text>
      </View>
      {goal.progress !== null ? (
        <View
          accessible
          {...(Platform.OS === 'web'
            ? {
                'aria-valuemin': 0,
                'aria-valuemax': 100,
                'aria-valuenow': goal.progress,
                'aria-valuetext': `現在 ${goal.currentValueLabel}、目標 ${goal.targetValueLabel}、${goal.progress}%`,
              }
            : {})}
          accessibilityRole="progressbar"
          accessibilityLabel={`進捗 ${goal.progress}%`}
          accessibilityValue={{
            min: 0,
            max: 100,
            now: goal.progress,
            text: `現在 ${goal.currentValueLabel}、目標 ${goal.targetValueLabel}、${goal.progress}%`,
          }}
          style={{
            height: 8,
            borderRadius: radius.pill,
            backgroundColor: colors.borderSubtle,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${goal.progress}%`,
              backgroundColor: goal.status === 'completed' ? colors.success : colors.primary,
            }}
          />
        </View>
      ) : null}
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
