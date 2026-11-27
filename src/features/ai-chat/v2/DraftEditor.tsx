import { formatCalendarDateJa } from '@/shared/dateInput';
import type { TaskGoalOption } from '@/features/tasks/repositories/TaskRepository';
import { policyLabels } from '@/features/recommendations/policy';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DeadlineField } from '@/shared/components/DeadlineField';
import { ActionButton } from '@/shared/components/ActionButton';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame, type ModalFrameProps } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { OptionGroup } from '@/shared/components/OptionGroup';
import { colors, spacing, typography } from '@/shared/theme';
import type {
  ChatRepository,
  Draft,
  DraftItem,
  PlanProposal,
  RecordProposal,
  StepProposal,
  PolicyProposal,
} from './repository';

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
  if (item.kind === 'policy') {
    const span = (Date.parse(item.endDate) - Date.parse(item.startDate)) / 86_400_000;
    return (
      Object.hasOwn(policyLabels, item.policyKind) &&
      isDate(item.startDate) &&
      isDate(item.endDate) &&
      span >= 0 &&
      span <= 13 &&
      (item.policyKind !== 'lighter_day' || span === 0)
    );
  }
  if (item.kind === 'plan') return isDate(item.date);
  if (item.kind !== 'step' && item.deadline && !isDate(item.deadline)) return false;
  if (
    item.kind === 'task' &&
    item.patch &&
    ['weekdays', 'weekly'].includes(String(item.patch.recurrence)) &&
    (!Array.isArray(item.patch.weekdays) || item.patch.weekdays.length === 0)
  )
    return false;
  return (
    item.kind === 'goal' ||
    item.minutes === null ||
    (Number.isInteger(item.minutes) && item.minutes >= 1 && item.minutes <= 1440)
  );
}
const priorityLabels = { low: '低', medium: '中', high: '高' };
function detail(
  item: Pick<RecordProposal, 'title' | 'priority' | 'deadline'> & { minutes?: number | null },
) {
  return `${item.title} ・ 優先度 ${priorityLabels[item.priority]} ・ ${item.deadline ? formatCalendarDateJa(item.deadline) : '期限なし'}${item.minutes ? ` ・ ${item.minutes}分` : ''}`;
}

function InlineFrame({ children, footer }: ModalFrameProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      {children}
      {footer}
    </View>
  );
}

export function DraftEditor({
  repository,
  draft,
  close,
  refreshed,
  reviewPlan,
  loadGoals,
  discardPrivate,
  inline = false,
  onDirtyChange,
}: {
  inline?: boolean;
  onDirtyChange?: (id: string, dirty: boolean) => void;
  repository: ChatRepository;
  draft: Draft;
  close: () => void;
  refreshed: () => Promise<void>;
  loadGoals?: () => Promise<TaskGoalOption[]>;
  discardPrivate?: () => void;
  reviewPlan: (plan: PlanProposal) => void;
}) {
  const [items, setItems] = useState(draft.items);
  const [selected, setSelected] = useState<string[]>(() =>
    draft.items
      .filter(
        (item) =>
          item.kind !== 'plan' && item.kind !== 'goal' && (item.kind !== 'task' || !item.goalKey),
      )
      .map((item) => item.key),
  );
  const [goals, setGoals] = useState<TaskGoalOption[]>();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(items) !== JSON.stringify(draft.items);
  useEffect(() => {
    onDirtyChange?.(draft.id, dirty);
  }, [draft.id, dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(draft.id, false), [draft.id, onDirtyChange]);
  const records = items.filter(
    (item): item is RecordProposal | StepProposal | PolicyProposal =>
      item.kind !== 'plan' && item.kind !== 'goal' && (item.kind !== 'task' || !item.goalKey),
  );
  const Frame = inline ? InlineFrame : ModalFrame;
  const closed = !!draft.approvedAt || !!draft.rejectedAt;
  const chosen = records.filter((item) => selected.includes(item.key));

  function update(item: DraftItem) {
    setItems((previous) =>
      previous.map((old) => {
        if (old.key !== item.key) return old;
        if (old.kind === 'task' && item.kind === 'task' && item.patch) {
          const patch = { ...item.patch };
          for (const field of ['title', 'priority', 'deadline', 'minutes'] as const)
            if (old[field] !== item[field]) patch[field] = item[field];
          return { ...item, patch };
        }
        return item;
      }),
    );
    setError('');
  }

  function validate(approve: boolean) {
    if ((approve ? chosen : records).every(inputValid)) return true;
    setError('名前、日付、作業時間、繰り返しを確認してください。');
    return false;
  }

  async function save(approve: boolean) {
    if (!validate(approve)) return;
    await finish(() => {
      if (!approve) return repository.edit(draft, items);
      const keys = chosen.map((item) => item.key);
      if (!dirty) return repository.approve(draft, keys);
      const edited = draft.items.map(
        (item) => chosen.find((value) => value.key === item.key) ?? item,
      );
      return repository.approve(draft, keys, edited);
    });
  }

  async function finish(operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError('');
    try {
      await operation();
      await refreshed();
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : '変更を保存できませんでした。');
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  const toggle = (key: string) =>
    setSelected((values) =>
      values.includes(key) ? values.filter((value) => value !== key) : [...values, key],
    );
  return (
    <Frame
      title={
        confirmation ? '採用内容を確認' : draft.calendarThreadId ? '推薦方針の提案' : '提案の下書き'
      }
      onClose={close}
      closeDisabled={pending}
      dirty={dirty}
      footer={
        closed ? null : (
          <View style={{ gap: spacing.sm }}>
            {dirty && !confirmation && !draft.calendarThreadId ? (
              <ActionButton
                label="下書きだけ保存"
                variant="ghost"
                loading={pending}
                onPress={() => void save(false)}
              />
            ) : null}
            {records.length ? (
              <ActionButton
                label={
                  inline
                    ? chosen.every(
                        (item) => item.kind === 'step' || (item.kind === 'task' && !item.targetId),
                      )
                      ? '追加'
                      : '適用'
                    : confirmation
                      ? `${chosen.length}件を承認`
                      : `${chosen.length}件の採用内容を確認`
                }
                disabled={!selected.length}
                loading={pending}
                onPress={() => {
                  if (inline || confirmation) void save(true);
                  else if (validate(true)) {
                    setError('');
                    setConfirmation(true);
                  }
                }}
              />
            ) : null}
            {!confirmation && (discardPrivate || repository.reject) ? (
              <ActionButton
                label="提案を却下"
                variant="ghost"
                disabled={pending}
                onPress={() => {
                  if (discardPrivate) discardPrivate();
                  else if (!draft.calendarThreadId && repository.reject)
                    void finish(() => repository.reject!(draft));
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
      {confirmation ? (
        <Text style={styles.selectionText}>
          {draft.calendarThreadId
            ? '選んだ方針の種類・対象・期間を保存します。相談文・回答・予定の詳細は履歴に残りません。'
            : '以下の内容を適用します。編集した項目は、ここに表示される値で保存されます。'}
        </Text>
      ) : null}
      {draft.approvedAt ? <Notice tone="success" message="承認済みの下書きです。" /> : null}
      {draft.rejectedAt ? <Notice message="この提案は却下されました。" /> : null}
      {(confirmation
        ? chosen
        : items.filter((item) => !draft.appliedKeys || draft.appliedKeys.includes(item.key))
      ).map((item) => {
        if (item.kind === 'policy') {
          return (
            <View key={item.key} style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
              <Text style={styles.selectionText}>
                推薦だけ変更 ・ {policyLabels[item.policyKind]} {item.targetTitle}
              </Text>
              <Text style={{ color: colors.textPrimary }}>
                {formatCalendarDateJa(item.startDate)} ～ {formatCalendarDateJa(item.endDate)}
              </Text>
              {!closed && !confirmation ? (
                <>
                  <Pressable
                    style={styles.selection}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${item.title}を採用`}
                    accessibilityState={{ checked: selected.includes(item.key), disabled: pending }}
                    disabled={pending}
                    onPress={() => toggle(item.key)}
                  >
                    <Text style={styles.selectionText}>
                      {selected.includes(item.key) ? '☑ 採用する' : '☐ 採用する'}
                    </Text>
                  </Pressable>
                  <ActionButton
                    label="期間を編集"
                    variant="ghost"
                    onPress={() => setEditing(editing === item.key ? null : item.key)}
                  />
                  {editing === item.key ? (
                    <>
                      <DeadlineField
                        label="開始日"
                        accessibilityLabel={`${item.title}の開始日`}
                        value={item.startDate}
                        allowClear={false}
                        disabled={pending}
                        onChange={(startDate) => update({ ...item, startDate })}
                      />
                      <DeadlineField
                        label="終了日"
                        accessibilityLabel={`${item.title}の終了日`}
                        value={item.endDate}
                        allowClear={false}
                        disabled={pending}
                        onChange={(endDate) => update({ ...item, endDate })}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
            </View>
          );
        }
        const legacy = item.kind === 'goal' || (item.kind === 'task' && !!item.goalKey);
        return (
          <View key={item.key} style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            <Text style={{ ...typography.sectionTitle, color: colors.textPrimary }}>
              {item.kind === 'plan'
                ? '計画'
                : item.kind === 'goal'
                  ? '目標'
                  : item.kind === 'step'
                    ? '小さな行動'
                    : 'タスク'}
              　{item.title}
            </Text>
            {item.kind === 'plan' ? (
              <>
                <Text style={{ color: colors.textPrimary }}>
                  対象日　{formatCalendarDateJa(item.date)}
                </Text>
                <ActionButton
                  label="Plannerで変更案を確認"
                  variant="secondary"
                  disabled={dirty}
                  onPress={() => reviewPlan(item)}
                />
              </>
            ) : (
              <>
                {legacy ? (
                  <Text style={{ color: colors.textSecondary }}>以前の提案（閲覧のみ）</Text>
                ) : null}
                {item.kind === 'task' && item.patch && (
                  <Text style={{ color: colors.textSecondary }}>
                    タスク本体を変更{item.patch.goalId === null ? ' ・ 関連目標を外す' : ''}
                    {typeof item.patch.recurrence === 'string'
                      ? ` ・ 繰り返し：${item.patch.recurrence === 'daily' ? '毎日' : item.patch.recurrence === 'once' ? 'なし' : Array.isArray(item.patch.weekdays) ? item.patch.weekdays.map((day) => '月火水木金土日'[Number(day) - 1]).join('・') : ''}`
                      : ''}
                  </Text>
                )}
                {item.kind !== 'step' && item.before ? (
                  <Text style={{ color: colors.textSecondary }}>変更前　{detail(item.before)}</Text>
                ) : null}
                <Text style={{ color: colors.textPrimary }}>
                  {item.kind === 'step'
                    ? `所要時間の目安　${item.minutes === null ? '未設定' : `${item.minutes}分`}`
                    : `${item.before ? '変更後　' : ''}${detail(item)}`}
                </Text>
                {item.parentTitle ? (
                  <Text style={{ color: colors.textSecondary }}>
                    {item.kind === 'step' ? '関連タスク' : '関連目標'}　{item.parentTitle}
                  </Text>
                ) : null}
                {item.reason ? (
                  <Text style={{ color: colors.textSecondary }}>{item.reason}</Text>
                ) : null}
                {item.kind === 'task' && item.goalKey ? (
                  <Text style={{ color: colors.textSecondary }}>
                    関連Goal　{items.find((goal) => goal.key === item.goalKey)?.title ?? '不明'}
                  </Text>
                ) : null}
                {!confirmation && !closed && !legacy ? (
                  <Pressable
                    style={styles.selection}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${item.title}を採用`}
                    accessibilityState={{ checked: selected.includes(item.key), disabled: pending }}
                    disabled={pending}
                    onPress={() =>
                      setSelected((values) =>
                        values.includes(item.key)
                          ? values.filter((key) => key !== item.key)
                          : [...values, item.key],
                      )
                    }
                  >
                    <Text style={styles.selectionText}>
                      {selected.includes(item.key) ? '☑ 採用する' : '☐ 採用する'}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
            {!confirmation && !closed && !legacy ? (
              <ActionButton
                label={editing === item.key ? '編集欄を閉じる' : '項目を編集'}
                variant="ghost"
                onPress={() => setEditing(editing === item.key ? null : item.key)}
              />
            ) : null}
            {item.kind === 'task' &&
            item.targetId &&
            draft.undoTaskIds?.includes(item.targetId) &&
            repository.undoTaskEdit ? (
              <ActionButton
                label="この編集を取り消す"
                variant="secondary"
                disabled={pending}
                onPress={() =>
                  void finish(() => repository.undoTaskEdit!(draft.id, item.targetId!))
                }
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
                  <DeadlineField
                    label="計画日"
                    accessibilityLabel={`${item.title}の計画日`}
                    value={item.date}
                    allowClear={false}
                    disabled={pending}
                    onChange={(date) => update({ ...item, date })}
                  />
                ) : (
                  <>
                    {item.kind !== 'step' ? (
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
                        <DeadlineField
                          label="期限"
                          accessibilityLabel={`${item.title}の期限`}
                          value={item.deadline ?? ''}
                          disabled={pending}
                          onChange={(value) => update({ ...item, deadline: value || null })}
                        />
                      </>
                    ) : null}
                    {item.kind === 'task' && item.patch ? (
                      <>
                        {loadGoals ? (
                          goals ? (
                            <OptionGroup
                              label="関連目標"
                              disabled={pending}
                              selectedValue={String(
                                'goalId' in item.patch
                                  ? (item.patch.goalId ?? '')
                                  : (item.before?.goalId ?? ''),
                              )}
                              options={[
                                { value: '', label: 'なし' },
                                ...goals.map((goal) => ({ value: goal.id, label: goal.title })),
                              ]}
                              onChange={(value) =>
                                update({
                                  ...item,
                                  goalId: value || null,
                                  parentUpdatedAt: null,
                                  parentTitle:
                                    goals.find((goal) => goal.id === value)?.title ?? null,
                                  patch: { ...item.patch, goalId: value || null },
                                })
                              }
                            />
                          ) : (
                            <ActionButton
                              label="関連目標を選ぶ"
                              variant="ghost"
                              disabled={pending}
                              onPress={() =>
                                void loadGoals().then(setGoals, () =>
                                  setError('目標を読み込めませんでした。'),
                                )
                              }
                            />
                          )
                        ) : null}
                        <OptionGroup
                          label="繰り返し"
                          disabled={pending}
                          selectedValue={String(
                            item.patch.recurrence ?? item.before?.recurrence ?? 'once',
                          ).replace('weekly', 'weekdays')}
                          options={[
                            { value: 'once', label: 'なし' },
                            { value: 'daily', label: '毎日' },
                            { value: 'weekdays', label: '曜日を選ぶ' },
                          ]}
                          onChange={(value) =>
                            update({
                              ...item,
                              patch: {
                                ...item.patch,
                                recurrence: value,
                                weekdays:
                                  value === 'weekdays'
                                    ? (item.patch?.weekdays ?? item.before?.weekdays ?? [])
                                    : [],
                              },
                            })
                          }
                        />
                        {['weekdays', 'weekly'].includes(
                          String(item.patch.recurrence ?? item.before?.recurrence),
                        ) ? (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                            {[...'月火水木金土日'].map((label, index) => {
                              const prior = item.patch?.weekdays ?? item.before?.weekdays;
                              const days = Array.isArray(prior) ? prior : [];
                              const value = index + 1;
                              return (
                                <ActionButton
                                  key={label}
                                  label={label}
                                  variant={days.includes(value) ? 'secondary' : 'ghost'}
                                  disabled={pending}
                                  onPress={() =>
                                    update({
                                      ...item,
                                      patch: {
                                        ...item.patch,
                                        recurrence: 'weekdays',
                                        weekdays: days.includes(value)
                                          ? days.filter((d) => d !== value)
                                          : [...days, value],
                                      },
                                    })
                                  }
                                />
                              );
                            })}
                          </View>
                        ) : null}
                      </>
                    ) : null}
                    {item.kind === 'task' || item.kind === 'step' ? (
                      <FormField label="所要時間の目安（分・任意）">
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
        );
      })}
    </Frame>
  );
}

const styles = StyleSheet.create({
  selection: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingRight: spacing.lg,
  },
  selectionText: { ...typography.bodyStrong, color: colors.primary },
});
