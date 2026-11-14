import { useState } from 'react';
import { Text, View } from 'react-native';
import { ActionButton } from '@/shared/components/ActionButton';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { OptionGroup } from '@/shared/components/OptionGroup';
import { colors, spacing, typography } from '@/shared/theme';
import type { ChatRepository, Draft, DraftItem, PlanProposal, RecordProposal } from './repository';

function isDate(value: string) {
  const parsed = new Date(value);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
function inputValid(item: DraftItem) {
  if (!item.title.trim()) return false;
  if (item.kind === 'plan') return isDate(item.date);
  if (item.deadline && !isDate(item.deadline)) return false;
  return (
    item.kind === 'goal' ||
    (item.minutes !== null &&
      Number.isInteger(item.minutes) &&
      item.minutes >= 1 &&
      item.minutes <= 1440)
  );
}
const priorityLabels = { low: '低', medium: '中', high: '高' };
function detail(
  item: Pick<RecordProposal, 'title' | 'priority' | 'deadline'> & { minutes?: number | null },
) {
  return `${item.title} ・ 優先度 ${priorityLabels[item.priority]} ・ ${item.deadline ?? '期限なし'}${item.minutes ? ` ・ ${item.minutes}分` : ''}`;
}

export function DraftEditor({
  repository,
  draft,
  close,
  refreshed,
  reviewPlan,
}: {
  repository: ChatRepository;
  draft: Draft;
  close: () => void;
  refreshed: () => Promise<void>;
  reviewPlan: (plan: PlanProposal) => void;
}) {
  const [items, setItems] = useState(draft.items);
  const [selected, setSelected] = useState<string[]>(() =>
    draft.items.filter((item) => item.kind !== 'plan').map((item) => item.key),
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(items) !== JSON.stringify(draft.items);
  const records = items.filter((item): item is RecordProposal => item.kind !== 'plan');
  const chosen = records.filter((item) => selected.includes(item.key));

  function update(item: DraftItem) {
    setItems((previous) => previous.map((old) => (old.key === item.key ? item : old)));
    setError('');
  }

  async function save(approve: boolean) {
    if (pending) return;
    if (items.some((item) => !inputValid(item))) {
      setError('名前、日付、作業時間を確認してください。');
      return;
    }
    if (approve && chosen.some((item) => item.goalKey && !selected.includes(item.goalKey))) {
      setError('採用するTaskが参照するGoalも選択してください。');
      return;
    }
    setPending(true);
    try {
      if (approve) await repository.approve(draft, selected);
      else await repository.edit(draft, items);
      await refreshed();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : '下書きを保存できませんでした。');
    } finally {
      setPending(false);
    }
  }
  return (
    <ModalFrame
      title={confirmation ? '採用内容を確認' : '提案の下書き'}
      onClose={close}
      closeDisabled={pending}
      footer={
        draft.approvedAt ? null : (
          <View style={{ gap: spacing.sm }}>
            {dirty && !confirmation ? (
              <ActionButton
                label="下書きを保存"
                loading={pending}
                onPress={() => void save(false)}
              />
            ) : null}
            {records.length ? (
              <ActionButton
                label={confirmation ? '選択項目を承認' : '選択項目を確認'}
                disabled={!selected.length || dirty}
                loading={pending}
                onPress={() => {
                  if (confirmation) void save(true);
                  else setConfirmation(true);
                }}
              />
            ) : null}
            {confirmation ? (
              <ActionButton
                label="選択に戻る"
                variant="ghost"
                disabled={pending}
                onPress={() => setConfirmation(false)}
              />
            ) : null}
          </View>
        )
      }
    >
      {error ? <Notice tone="error" message={error} /> : null}
      {draft.approvedAt ? <Notice tone="success" message="承認済みの下書きです。" /> : null}
      {(confirmation ? chosen : items).map((item) => (
        <View key={item.key} style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
          <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>
            {item.kind === 'plan' ? '計画' : item.kind === 'goal' ? 'Goal' : 'Task'}　{item.title}
          </Text>
          {item.kind === 'plan' ? (
            <>
              <Text style={{ color: colors.textPrimary }}>対象日　{item.date}</Text>
              <ActionButton
                label="Plannerで変更案を確認"
                variant="secondary"
                disabled={dirty}
                onPress={() => reviewPlan(item)}
              />
            </>
          ) : (
            <>
              {item.before ? (
                <Text style={{ color: colors.textSecondary }}>変更前　{detail(item.before)}</Text>
              ) : null}
              <Text style={{ color: colors.textPrimary }}>
                {item.before ? '変更後　' : ''}
                {detail(item)}
              </Text>
              {item.goalKey ? (
                <Text style={{ color: colors.textSecondary }}>
                  関連Goal　{items.find((goal) => goal.key === item.goalKey)?.title ?? '不明'}
                </Text>
              ) : null}
              {!confirmation && !draft.approvedAt ? (
                <ActionButton
                  label={selected.includes(item.key) ? '✓ 採用する' : '採用する'}
                  accessibilityLabel={`${item.title}を採用`}
                  variant={selected.includes(item.key) ? 'primary' : 'secondary'}
                  onPress={() =>
                    setSelected((values) =>
                      values.includes(item.key)
                        ? values.filter((key) => key !== item.key)
                        : [...values, item.key],
                    )
                  }
                />
              ) : null}
            </>
          )}
          {!confirmation && !draft.approvedAt ? (
            <ActionButton
              label={editing === item.key ? '編集欄を閉じる' : '項目を編集'}
              variant="ghost"
              onPress={() => setEditing(editing === item.key ? null : item.key)}
            />
          ) : null}
          {editing === item.key && !confirmation ? (
            <>
              <FormField label="名前">
                <FormInput
                  value={item.title}
                  onChangeText={(title) => update({ ...item, title })}
                  maxLength={200}
                />
              </FormField>
              {item.kind === 'plan' ? (
                <FormField label="日付（YYYY-MM-DD）">
                  <FormInput value={item.date} onChangeText={(date) => update({ ...item, date })} />
                </FormField>
              ) : (
                <>
                  <OptionGroup
                    label="優先度"
                    disabled={pending}
                    selectedValue={item.priority}
                    options={[
                      { value: 'low', label: '低' },
                      { value: 'medium', label: '中' },
                      { value: 'high', label: '高' },
                    ]}
                    onChange={(value) =>
                      update({
                        ...item,
                        priority: value === 'high' || value === 'low' ? value : 'medium',
                      })
                    }
                  />
                  <FormField label="期限（YYYY-MM-DD）">
                    <FormInput
                      value={item.deadline ?? ''}
                      onChangeText={(value) => update({ ...item, deadline: value || null })}
                    />
                  </FormField>
                  {item.kind === 'task' ? (
                    <FormField label="基本作業時間（分）">
                      <FormInput
                        keyboardType="number-pad"
                        value={item.minutes === null ? '' : String(item.minutes)}
                        onChangeText={(value) =>
                          update({ ...item, minutes: value ? Number(value) : null })
                        }
                      />
                    </FormField>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </View>
      ))}
    </ModalFrame>
  );
}
