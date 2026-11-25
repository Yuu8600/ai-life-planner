import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { Card } from '@/shared/components/Card';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { colors, spacing, typography } from '@/shared/theme';
import { CalendarShareEditor, type ReadShareableCalendar } from './CalendarShareEditor';
import type { TaskGoalOption } from '@/features/tasks/repositories/TaskRepository';
import { DraftEditor } from './DraftEditor';
import type {
  CalendarShare,
  ChatFocus,
  ChatRepository,
  Draft,
  PlanProposal,
  PrivateConsultation,
  Thread,
  Usage,
} from './repository';

export function ChatScreen({
  repository,
  reviewPlan,
  focus,
  initialDate,
  taskEditIntent,
  readCalendar,
  loadGoals,
  openApplied,
}: {
  repository: ChatRepository;
  focus?: ChatFocus;
  initialDate?: string;
  taskEditIntent?: boolean;
  openApplied?: (recommendations: boolean) => void;
  loadGoals?: () => Promise<TaskGoalOption[]>;
  readCalendar?: ReadShareableCalendar;
  reviewPlan: (plan: PlanProposal) => void;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [newTitle, setNewTitle] = useState<string>();
  const [current, setCurrent] = useState<Thread>();
  const [conversation, setConversation] = useState<Awaited<ReturnType<ChatRepository['open']>>>();
  const [usage, setUsage] = useState<Usage>();
  const [usageChecking, setUsageChecking] = useState(false);
  const [usageFailed, setUsageFailed] = useState(false);
  const [prompt, setPrompt] = useState(() =>
    focus
      ? taskEditIntent
        ? `「${focus.title.slice(0, 200)}」の変更について相談したい。`
        : `「${focus.title.slice(0, 200)}」を進める小さな行動を3〜5件提案してください。`
      : '',
  );
  const [activeFocus, setActiveFocus] = useState(focus);
  const [date, setDate] = useState(initialDate ?? '');
  const [calendar, setCalendar] = useState<CalendarShare>();
  const [privateReply, setPrivateReply] = useState<PrivateConsultation>();
  const [dateDraft, setDateDraft] = useState<string>();
  const scroll = useRef<ScrollView>(null);
  const inputJump = useRef(false);
  const [workingDraft, setWorkingDraft] = useState<Draft>();
  const [referencedDraft, setReferencedDraft] = useState<string>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const lock = useRef(false);
  const threadCreatedBySend = useRef<string | undefined>(undefined);

  const refreshUsage = useCallback(async () => {
    setUsageChecking(true);
    try {
      setUsage(await repository.usage());
      setUsageFailed(false);
    } catch {
      setUsage(undefined);
      setUsageFailed(true);
    } finally {
      setUsageChecking(false);
    }
  }, [repository]);
  const refreshThreads = useCallback(async () => {
    try {
      setThreads(await repository.listThreads());
    } catch {
      setError('会話一覧を読み込めませんでした。');
    }
  }, [repository]);
  useEffect(() => {
    let active = true;
    void repository.listThreads().then(
      (value) => {
        if (active) setThreads(value);
      },
      () => {
        if (active) setError('会話一覧を読み込めませんでした。');
      },
    );
    void repository.usage().then(
      (value) => {
        if (active) setUsage(value);
      },
      () => {
        if (active) setUsageFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [repository]);

  const refreshConversation = useCallback(
    async (id: string) => {
      const fresh = await repository.open(id);
      setConversation((previous) => {
        const first = fresh.messages[0];
        const overlap = first ? previous?.messages.findIndex((item) => item.id === first.id) : -1;
        if (!previous || overlap === undefined || overlap < 0) return fresh;
        return {
          ...fresh,
          olderCursor: previous.olderCursor,
          messages: [...previous.messages.slice(0, overlap), ...fresh.messages],
        };
      });
    },
    [repository],
  );
  useEffect(() => {
    if (!current || threadCreatedBySend.current === current.id) return;
    let active = true;
    void repository.open(current.id).then(
      (value) => {
        if (active) setConversation(value);
      },
      () => {
        if (active) setError('会話を読み込めませんでした。');
      },
    );
    return () => {
      active = false;
    };
  }, [current, repository]);
  const open = (thread?: Thread) => {
    inputJump.current = Boolean(thread);
    threadCreatedBySend.current = undefined;
    setCurrent(thread);
    setConversation(undefined);
    setPrompt('');
    setActiveFocus(undefined);
    setDate('');
    setCalendar(undefined);
    setPrivateReply(undefined);
    setReferencedDraft(undefined);
    setError('');
  };
  async function loadOlder() {
    const cursor = conversation?.olderCursor;
    if (!current || !cursor || lock.current) return;
    lock.current = true;
    setLoadingOlder(true);
    setError('');
    try {
      const page = await repository.listOlder(current.id, cursor);
      setConversation(
        (previous) =>
          previous && {
            ...previous,
            messages: [...page.messages, ...previous.messages],
            olderCursor: page.olderCursor,
          },
      );
    } catch {
      setError('以前のメッセージを読み込めませんでした。');
    } finally {
      lock.current = false;
      setLoadingOlder(false);
    }
  }
  async function create() {
    if (lock.current || !newTitle?.trim()) return;
    lock.current = true;
    setPending(true);
    setError('');
    try {
      const thread = await repository.createThread(newTitle.trim());
      await refreshThreads();
      open(thread);
      setNewTitle(undefined);
    } catch {
      setError('会話を作成できませんでした。');
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  async function send() {
    if (
      !prompt.trim() ||
      lock.current ||
      !usage?.configured ||
      !usage.remainingMicros ||
      (calendar && !usage.calendarSharing)
    )
      return;
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    ) {
      setError('日付は実在するYYYY-MM-DD形式で入力してください。');
      return;
    }
    lock.current = true;
    setPending(true);
    setError('');
    let thread = current;
    try {
      if (!thread) {
        thread = await repository.createThread(
          calendar
            ? '予定の相談'
            : (activeFocus?.title.slice(0, 100) ?? prompt.trim().slice(0, 40)),
        );
        threadCreatedBySend.current = thread.id;
        setCurrent(thread);
        void refreshThreads();
      }
      if (calendar) {
        const reply = await repository.send(
          thread.id,
          prompt.trim(),
          calendar.date,
          undefined,
          activeFocus,
          calendar,
        );
        if (reply) setPrivateReply(reply);
      } else if (activeFocus) {
        await repository.send(
          thread.id,
          prompt.trim(),
          date || undefined,
          referencedDraft,
          activeFocus,
        );
      } else {
        await repository.send(thread.id, prompt.trim(), date || undefined, referencedDraft);
      }
      setCalendar(undefined);
      setPrompt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'メッセージを送信できませんでした。');
    } finally {
      inputJump.current = true;
      await Promise.all([
        thread && refreshConversation(thread.id).catch(() => undefined),
        refreshUsage(),
      ]);
      lock.current = false;
      setPending(false);
    }
  }
  useEffect(() => {
    if (!conversation || !inputJump.current) return;
    const frame = requestAnimationFrame(() => {
      inputJump.current = false;
      scroll.current?.scrollToEnd({ animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [conversation]);

  const recheckAI = (
    <ActionButton
      label="AIの設定を再確認"
      variant="ghost"
      loading={usageChecking}
      disabled={pending}
      onPress={() => void refreshUsage()}
    />
  );
  const composer = (
    <View style={styles.composer}>
      {calendar ? (
        <Text style={styles.small}>
          次の送信で
          {calendar.mode === 'selected_event_details'
            ? `予定${calendar.events.length}件の詳細${calendar.includeLocation ? 'と場所' : ''}`
            : '予定の有無'}
          を共有。相談文と回答は履歴に残りません。
        </Text>
      ) : null}
      {referencedDraft ? <Text style={styles.small}>下書きの最新版について相談中</Text> : null}
      {activeFocus ? <Text style={styles.small}>相談の対象　{activeFocus.title}</Text> : null}
      <FormField label="相談内容">
        <FormInput
          multiline
          value={prompt}
          editable={!pending}
          maxLength={1000}
          onChangeText={setPrompt}
          style={styles.input}
          placeholder="メッセージを入力"
        />
      </FormField>
      <View style={styles.actions}>
        <ActionButton
          label={calendar ? '共有内容を変更' : '参照情報'}
          variant="ghost"
          disabled={pending}
          onPress={() => setDateDraft(date)}
        />
        <ActionButton
          label={calendar ? '共有して送信' : '送信'}
          accessibilityLabel="AIに送信"
          loading={pending}
          disabled={
            loadingOlder ||
            (calendar && !usage?.calendarSharing) ||
            !usage?.configured ||
            usage.remainingMicros === 0 ||
            !prompt.trim()
          }
          onPress={() => void send()}
        />
      </View>
    </View>
  );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <AppScreen contentContainerStyle={{ gap: spacing.md }} footer={composer} scrollRef={scroll}>
        <ScreenHeader
          title={current?.title ?? 'AI相談'}
          action={
            current ? (
              <ActionButton
                label="会話一覧"
                variant="secondary"
                disabled={pending || loadingOlder}
                onPress={() => open()}
              />
            ) : (
              <ActionButton label="新規会話" loading={pending} onPress={() => setNewTitle('')} />
            )
          }
        />
        {usage?.configured ? (
          <Text style={{ color: colors.textSecondary }}>
            {usage.remainingMicros
              ? `今月の残り予算（推定） $${(usage.remainingMicros / 1_000_000).toFixed(3)} / $0.50（UTC月ごと）`
              : '今月のAI予算を使い切りました。会話や下書きは引き続き確認できます。'}
          </Text>
        ) : usage || usageFailed ? (
          <Notice
            tone="warning"
            message={
              usageFailed
                ? 'AIに接続できません。通信を確認して再試行してください。'
                : 'AIは未設定です。サーバー設定が反映されたら再確認してください。'
            }
            action={recheckAI}
          />
        ) : null}
        {error ? <Notice tone="error" message={error} /> : null}
        {current ? (
          <>
            {conversation?.olderCursor ? (
              <ActionButton
                label="以前のメッセージを表示"
                variant="secondary"
                loading={loadingOlder}
                disabled={pending}
                onPress={() => void loadOlder()}
              />
            ) : null}
            {conversation?.messages.map((item) => (
              <Card
                key={item.id}
                style={item.role === 'user' ? styles.userMessage : styles.assistantMessage}
              >
                <Text
                  accessibilityRole="header"
                  style={{ ...typography.label, color: colors.textSecondary }}
                >
                  {item.role === 'user' ? 'あなた' : 'AI'}
                </Text>
                <Text style={{ ...typography.body, color: colors.textPrimary }}>{item.body}</Text>
              </Card>
            ))}
            {conversation?.drafts.map((draft) => (
              <Card key={draft.id} style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.textPrimary }}>
                  {draft.approvedAt
                    ? '適用しました'
                    : draft.rejectedAt
                      ? '却下済み'
                      : '提案の下書き'}
                  　
                  {draft.items
                    .filter((item) => !draft.appliedKeys || draft.appliedKeys.includes(item.key))
                    .map((item) => item.title)
                    .join('、')}
                </Text>
                <ActionButton
                  label="下書きを開く"
                  variant="secondary"
                  disabled={pending || loadingOlder}
                  onPress={() => setWorkingDraft(draft)}
                />
                {draft.appliedKeys && openApplied ? (
                  <ActionButton
                    label={
                      draft.items.some(
                        (item) => item.kind === 'policy' && draft.appliedKeys?.includes(item.key),
                      )
                        ? '今日で確認'
                        : 'タスクを見る'
                    }
                    variant="ghost"
                    onPress={() =>
                      openApplied(
                        draft.items.some(
                          (item) => item.kind === 'policy' && draft.appliedKeys?.includes(item.key),
                        ),
                      )
                    }
                  />
                ) : null}
                {!draft.approvedAt && !draft.rejectedAt ? (
                  <ActionButton
                    label={
                      referencedDraft === draft.id
                        ? 'この下書きへの相談を解除'
                        : 'この下書きについて相談'
                    }
                    variant="ghost"
                    disabled={pending || loadingOlder}
                    onPress={() =>
                      setReferencedDraft(referencedDraft === draft.id ? undefined : draft.id)
                    }
                  />
                ) : null}
              </Card>
            ))}
            {privateReply ? (
              <Card style={{ gap: spacing.sm }}>
                <Text style={styles.small}>履歴に保存されない回答</Text>
                <Text style={{ color: colors.textPrimary }}>{privateReply.reply}</Text>
                {privateReply.policies.length ? (
                  <ActionButton
                    label="推薦方針の提案を確認"
                    variant="secondary"
                    disabled={pending || loadingOlder}
                    onPress={() =>
                      setWorkingDraft({
                        id: privateReply.requestId,
                        revision: privateReply.requestId,
                        approvedAt: null,
                        calendarThreadId: current.id,
                        items: privateReply.policies,
                      })
                    }
                  />
                ) : null}
              </Card>
            ) : null}
            {workingDraft ? (
              <DraftEditor
                key={workingDraft.id}
                draft={workingDraft}
                loadGoals={loadGoals}
                repository={repository}
                close={() => setWorkingDraft(undefined)}
                refreshed={async () => {
                  await refreshConversation(current.id);
                  if (workingDraft.calendarThreadId)
                    setPrivateReply((value) => value && { ...value, policies: [] });
                }}
                discardPrivate={
                  workingDraft.calendarThreadId
                    ? () => {
                        setPrivateReply((value) => value && { ...value, policies: [] });
                        setWorkingDraft(undefined);
                      }
                    : undefined
                }
                reviewPlan={(plan) => {
                  setWorkingDraft(undefined);
                  reviewPlan(plan);
                }}
              />
            ) : null}
          </>
        ) : (
          threads.map((thread) => (
            <ActionButton
              key={thread.id}
              variant="secondary"
              label={thread.title}
              disabled={pending || loadingOlder}
              onPress={() => open(thread)}
            />
          ))
        )}
        {dateDraft !== undefined ? (
          <CalendarShareEditor
            initialDate={dateDraft}
            readEvents={usage?.calendarSharing ? readCalendar : undefined}
            close={() => setDateDraft(undefined)}
            apply={(value, share) => {
              setDate(value);
              setCalendar(share);
              setDateDraft(undefined);
            }}
          />
        ) : null}
        {newTitle !== undefined ? (
          <ModalFrame
            title="新規会話"
            onClose={() => setNewTitle(undefined)}
            closeDisabled={pending}
            footer={
              <ActionButton
                label="会話を作成"
                disabled={!newTitle.trim()}
                loading={pending}
                onPress={() => void create()}
              />
            }
          >
            <FormField label="会話名">
              <FormInput
                value={newTitle}
                maxLength={100}
                onChangeText={setNewTitle}
                editable={!pending}
              />
            </FormField>
            {error ? <Notice tone="error" message={error} /> : null}
          </ModalFrame>
        ) : null}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  composer: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  input: { maxHeight: 120 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  small: { ...typography.caption, color: colors.primary },
  userMessage: { backgroundColor: colors.primarySoft, marginLeft: spacing.xl, gap: spacing.xs },
  assistantMessage: { marginRight: spacing.xl, gap: spacing.xs },
});
