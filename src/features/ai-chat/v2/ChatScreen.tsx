import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { appAlert } from '@/shared/feedback/appAlert';
import { Card } from '@/shared/components/Card';
import { FormField, FormInput } from '@/shared/components/FormField';
import { Notice } from '@/shared/components/Notice';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { radius, spacing, typography, useThemeColors } from '@/shared/theme';
import { confirmDiscardChanges } from '@/shared/feedback/confirmDiscardChanges';
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
  prepareCalendar = false,
}: {
  repository: ChatRepository;
  prepareCalendar?: boolean;
  focus?: ChatFocus;
  initialDate?: string;
  taskEditIntent?: boolean;
  openApplied?: (recommendations: boolean) => void;
  loadGoals?: () => Promise<TaskGoalOption[]>;
  readCalendar?: ReadShareableCalendar;
  reviewPlan: (plan: PlanProposal) => void;
}) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [composingNew, setComposingNew] = useState(!!focus);
  const [autoShare, setAutoShare] = useState(prepareCalendar);
  const [dirtyDrafts, setDirtyDrafts] = useState<Set<string>>(() => new Set());
  const trackDraftDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyDrafts((old) => {
      if (old.has(id) === dirty) return old;
      const next = new Set(old);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const [managing, setManaging] = useState<Thread>();
  const [manageTitle, setManageTitle] = useState('');
  const [manageError, setManageError] = useState('');
  const [threadMessage, setThreadMessage] = useState('');
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
  const [dateDraft, setDateDraft] = useState<string | undefined>(() =>
    prepareCalendar ? (initialDate ?? '') : undefined,
  );
  const scroll = useRef<ScrollView>(null);
  const inputJump = useRef(false);
  const [workingDraft, setWorkingDraft] = useState<Draft>();
  const [referencedDraft, setReferencedDraft] = useState<string>();
  const [error, setError] = useState('');
  const [threadReload, setThreadReload] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const lock = useRef(false);
  const threadCreatedBySend = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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
        if (active) {
          setConversation(value);
          setError('');
        }
      },
      () => {
        if (active) setError('会話を読み込めませんでした。');
      },
    );
    return () => {
      active = false;
    };
  }, [current, repository, threadReload]);
  const open = (thread?: Thread, newConversation = false) => {
    if (lock.current) return;
    confirmDiscardChanges(!!prompt.trim() || !!calendar || dirtyDrafts.size > 0, () => {
      Keyboard.dismiss();
      inputJump.current = Boolean(thread);
      threadCreatedBySend.current = undefined;
      setCurrent(thread);
      setComposingNew(newConversation);
      setDirtyDrafts(new Set());
      setConversation(undefined);
      setPrompt('');
      setActiveFocus(undefined);
      setDate('');
      setCalendar(undefined);
      setPrivateReply(undefined);
      setThreadMessage('');
      setReferencedDraft(undefined);
      setError('');
      if (!thread) void refreshThreads();
    });
  };
  async function manageThread(operation: () => Promise<Thread | void>, message: string) {
    if (lock.current || !managing) return;
    lock.current = true;
    setPending(true);
    setManageError('');
    try {
      const saved = await operation();
      setThreads((old) =>
        saved
          ? [saved, ...old.filter((item) => item.id !== managing.id)]
          : old.filter((item) => item.id !== managing.id),
      );
      setManaging(undefined);
      setThreadMessage(message);
    } catch (error) {
      setManageError(error instanceof Error ? error.message : '会話を更新できませんでした。');
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  function renameThread() {
    if (
      !managing ||
      !repository.renameThread ||
      !manageTitle.trim() ||
      manageTitle.trim() === managing.title
    )
      return;
    const thread = managing;
    void manageThread(
      () => repository.renameThread!(thread, manageTitle),
      '会話名を変更しました。',
    );
  }
  function confirmRemoveThread() {
    if (!managing || !repository.removeThread || lock.current) return;
    const thread = managing;
    appAlert.alert(
      '会話を削除しますか？',
      `「${thread.title}」の会話・提案・変更を取り消す履歴を削除します。保存済みのタスクと推薦方針は残ります。元に戻せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () =>
            void manageThread(() => repository.removeThread!(thread), '会話を削除しました。'),
        },
      ],
    );
  }
  function threadDate(thread: Thread) {
    const value = thread.updatedAt ?? thread.createdAt;
    if (!value || !Number.isFinite(Date.parse(value))) return '';
    return `${thread.updatedAt ? '更新' : '作成'} ${new Date(value).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  }
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
        thread &&
          refreshConversation(thread.id).catch(() => {
            setError(
              (prev) => prev || '会話の最新表示を読み込めませんでした。再試行してください。',
            );
          }),
        refreshUsage(),
        refreshThreads(),
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

  const messages = conversation?.messages ?? [];
  const drafts = conversation?.drafts ?? [];
  const owner = (draft: Draft) =>
    messages
      .filter(
        (message) =>
          message.role === 'assistant' &&
          message.createdAt &&
          draft.createdAt &&
          Date.parse(message.createdAt) <= Date.parse(draft.createdAt),
      )
      .at(-1)?.id;
  const proposalCard = (draft: Draft) => (
    <Card key={draft.id} style={{ gap: spacing.sm }}>
      {draft.approvedAt || draft.rejectedAt ? (
        <>
          <Text style={{ color: colors.textPrimary }}>
            {draft.approvedAt ? '保存しました' : '提案を取り消しました'}
            {'　'}
            {draft.items
              .filter((item) => !draft.appliedKeys || draft.appliedKeys.includes(item.key))
              .map((item) => item.title)
              .join('、')}
          </Text>
          {draft.approvedAt && openApplied ? (
            <ActionButton
              label="保存内容を見る"
              variant="ghost"
              onPress={() => openApplied(draft.items.some((item) => item.kind === 'policy'))}
            />
          ) : null}
          {draft.undoTaskIds?.length ? (
            <ActionButton
              label="変更を確認・取り消す"
              variant="ghost"
              onPress={() => setWorkingDraft(draft)}
            />
          ) : null}
        </>
      ) : (
        <>
          <Text style={{ color: colors.textPrimary }}>操作の提案 · 確認後に保存されます</Text>
          <DraftEditor
            key={draft.revision}
            inline
            onDirtyChange={trackDraftDirty}
            draft={draft}
            repository={repository}
            loadGoals={loadGoals}
            close={() => undefined}
            refreshed={async () => {
              if (current) await refreshConversation(current.id);
            }}
            reviewPlan={reviewPlan}
          />
        </>
      )}
    </Card>
  );

  const recheckAI = (
    <ActionButton
      label="接続を再確認"
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
          keyboardDismissAccessory={false}
          value={prompt}
          editable={!pending}
          maxLength={1000}
          onChangeText={setPrompt}
          style={styles.input}
          placeholder="メッセージを入力"
        />
      </FormField>
      <View style={styles.actions}>
        <View style={styles.actionGroup}>
          <ActionButton
            label={calendar ? '共有内容を変更' : '参照情報'}
            variant="ghost"
            disabled={pending}
            onPress={() => {
              Keyboard.dismiss();
              setAutoShare(false);
              setDateDraft(date);
            }}
          />
          {keyboardOpen ? (
            <ActionButton
              label="キーボードを閉じる"
              variant="ghost"
              onPress={() => Keyboard.dismiss()}
            />
          ) : null}
        </View>
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
      <AppScreen
        contentContainerStyle={{ gap: spacing.md }}
        footer={usage?.configured && usage.remainingMicros > 0 ? composer : undefined}
        scrollRef={scroll}
        header={
          <ScreenHeader
            title={current?.title ?? (composingNew ? '新しい相談' : 'AI相談')}
            backAction={
              current || composingNew
                ? {
                    label: '会話一覧',
                    accessibilityLabel: '会話一覧',
                    disabled: pending || loadingOlder,
                    onPress: () => open(),
                  }
                : undefined
            }
            action={
              current ||
              composingNew ||
              !usage?.configured ||
              usage.remainingMicros <= 0 ? undefined : (
                <ActionButton
                  label="新規会話"
                  loading={pending}
                  disabled={pending}
                  onPress={() => {
                    open(undefined, true);
                  }}
                />
              )
            }
          />
        }
      >
        {threadMessage ? <Notice tone="success" message={threadMessage} /> : null}
        {!current && threads.some((thread) => thread.canManage === false) ? (
          <Notice message="会話の名前変更・削除は現在利用できません。履歴は引き続き確認できます。" />
        ) : null}
        {prepareCalendar && usage && !usage.calendarSharing ? (
          <Notice
            tone="warning"
            message="現在のAI環境では予定共有を準備できません。会話履歴は引き続き確認できます。"
          />
        ) : null}
        {composingNew && usage?.configured ? (
          <View style={styles.actionGroup}>
            {[
              '今日のタスクを整理したい',
              '目標に向けた次の一歩を考えたい',
              '期限切れを整理したい',
            ].map((text) => (
              <ActionButton
                key={text}
                label={text}
                variant="secondary"
                disabled={pending}
                onPress={() => setPrompt(text)}
              />
            ))}
          </View>
        ) : null}
        {usage?.configured ? (
          <Text style={{ color: colors.textSecondary }}>
            {usage.remainingMicros
              ? `今月の残り利用枠（目安）：${Math.max(0, Math.min(100, Math.round((usage.remainingMicros / 500_000) * 100)))}%（毎月1日リセット・残り $${(usage.remainingMicros / 1_000_000).toFixed(2)}）`
              : '今月のAI利用枠を使い切りました。会話や下書きは引き続き確認できます。'}
          </Text>
        ) : usage || usageFailed ? (
          <Notice
            tone="warning"
            message={
              usageFailed
                ? 'AIに接続できません。通信を確認して再試行してください。'
                : '現在AI相談は利用できません。通常の「今日」や「タスク」はそのまま使えます。'
            }
            action={recheckAI}
          />
        ) : null}
        {error ? (
          <Notice
            tone="error"
            message={error}
            action={
              current ? (
                <ActionButton
                  label="再試行"
                  variant="secondary"
                  disabled={pending}
                  onPress={() => setThreadReload((count) => count + 1)}
                />
              ) : (
                <ActionButton
                  label="一覧を再読み込み"
                  variant="secondary"
                  disabled={pending}
                  onPress={() => {
                    setError('');
                    void refreshThreads();
                  }}
                />
              )
            }
          />
        ) : null}
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
            {drafts.filter((draft) => !owner(draft)).map(proposalCard)}
            {messages.map((item) => {
              const isUser = item.role === 'user';
              return (
                <View key={item.id} style={{ gap: spacing.sm }}>
                  <Card style={isUser ? styles.userMessage : styles.assistantMessage}>
                    <Text
                      accessibilityRole="header"
                      style={{
                        ...typography.caption,
                        fontWeight: '700',
                        color: isUser ? colors.onPrimary : colors.primary,
                      }}
                    >
                      {isUser ? 'あなた' : 'AI'}
                    </Text>
                    <Text
                      style={{
                        ...typography.body,
                        color: isUser ? colors.onPrimary : colors.textPrimary,
                      }}
                    >
                      {item.body}
                    </Text>
                  </Card>
                  {drafts.filter((draft) => owner(draft) === item.id).map(proposalCard)}
                </View>
              );
            })}
            {privateReply ? (
              <Card style={{ gap: spacing.sm }}>
                <Text style={styles.small}>履歴に保存されない回答</Text>
                <Text style={{ color: colors.textPrimary }}>{privateReply.reply}</Text>
                {privateReply.policies.length ? (
                  <DraftEditor
                    inline
                    key={privateReply.requestId}
                    draft={{
                      id: privateReply.requestId,
                      revision: privateReply.requestId,
                      approvedAt: null,
                      calendarThreadId: current.id,
                      items: privateReply.policies,
                    }}
                    loadGoals={loadGoals}
                    repository={repository}
                    close={() => undefined}
                    refreshed={async () => {
                      await refreshConversation(current.id);
                      setPrivateReply((value) => value && { ...value, policies: [] });
                    }}
                    discardPrivate={() =>
                      setPrivateReply((value) => value && { ...value, policies: [] })
                    }
                    reviewPlan={reviewPlan}
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
        ) : !composingNew && threads.length > 0 ? (
          <Card style={styles.threadList}>
            {threads.map((thread, index) => (
              <View key={thread.id} style={[styles.threadRow, index > 0 && styles.threadDivider]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={thread.title}
                  accessibilityHint={threadDate(thread)}
                  disabled={pending || loadingOlder}
                  onPress={() => open(thread)}
                  style={({ pressed }) => [
                    styles.threadLeading,
                    { minHeight: 44, opacity: pressed ? 0.65 : 1 },
                  ]}
                >
                  <View style={styles.threadDot}>
                    <Text style={styles.threadDotText} accessible={false}>
                      ✦
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text style={styles.threadTitle} numberOfLines={1}>
                      {thread.title}
                    </Text>
                    {threadDate(thread) ? (
                      <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                        {threadDate(thread)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.threadChevron} accessible={false}>
                    ›
                  </Text>
                </Pressable>
                {thread.canManage !== false &&
                (repository.renameThread || repository.removeThread) ? (
                  <ActionButton
                    label="その他"
                    accessibilityLabel={`${thread.title}の会話を管理`}
                    variant="ghost"
                    disabled={pending || loadingOlder}
                    onPress={() => {
                      Keyboard.dismiss();
                      setManaging(thread);
                      setManageTitle(thread.title);
                      setManageError('');
                      setThreadMessage('');
                    }}
                  />
                ) : null}
              </View>
            ))}
          </Card>
        ) : (
          <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
            {usage?.configured && usage.remainingMicros > 0
              ? '相談内容を入力すると会話を開始します。最初の送信まで会話は作成されません。'
              : '保存済みの会話はここから確認できます。'}
          </Text>
        )}
        {managing ? (
          <ModalFrame
            title="会話の管理"
            onClose={() => setManaging(undefined)}
            closeDisabled={pending}
            dirty={manageTitle !== managing.title}
            footer={
              repository.renameThread ? (
                <ActionButton
                  label="名前を保存"
                  loading={pending}
                  disabled={!manageTitle.trim() || manageTitle.trim() === managing.title}
                  onPress={renameThread}
                />
              ) : undefined
            }
          >
            <FormField label="会話名">
              <FormInput
                accessibilityLabel="会話名"
                value={manageTitle}
                maxLength={100}
                editable={!pending}
                onChangeText={setManageTitle}
              />
            </FormField>
            {repository.removeThread ? (
              <ActionButton
                label="会話を削除"
                variant="destructive"
                disabled={pending}
                onPress={confirmRemoveThread}
              />
            ) : null}
            {manageError ? (
              <Notice
                tone="error"
                message={manageError}
                action={
                  <ActionButton
                    label="一覧を再読み込み"
                    variant="secondary"
                    disabled={pending}
                    onPress={() => {
                      confirmDiscardChanges(manageTitle !== managing.title, () => {
                        setManaging(undefined);
                        void refreshThreads();
                      });
                    }}
                  />
                }
              />
            ) : null}
          </ModalFrame>
        ) : null}
        {dateDraft !== undefined && (!autoShare || usage?.calendarSharing) ? (
          <CalendarShareEditor
            initialDate={dateDraft}
            autoPrepare={autoShare}
            readEvents={usage?.calendarSharing ? readCalendar : undefined}
            close={() => setDateDraft(undefined)}
            apply={(value, share) => {
              setDate(value);
              setCalendar(share);
              setDateDraft(undefined);
            }}
          />
        ) : null}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    composer: {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
        android: { elevation: 4 },
        web: { boxShadow: '0 -2px 10px rgba(15, 23, 42, 0.04)' } as object,
      }),
    },
    input: { maxHeight: 120, borderRadius: radius.md },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.xs,
    },
    actionGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.xs,
    },
    threadList: { padding: 0, gap: 0, overflow: 'hidden' },
    threadRow: {
      minHeight: 56,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    threadLeading: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minWidth: 0,
    },
    threadDot: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    threadDotText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    threadDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSubtle,
    },
    threadTitle: { ...typography.bodyStrong, color: colors.textPrimary, flex: 1 },
    threadChevron: { ...typography.sectionTitle, color: colors.textSecondary },
    small: { ...typography.caption, color: colors.primary },
    userMessage: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      borderBottomRightRadius: 6,
      marginLeft: spacing.xl,
      gap: spacing.xs,
    },
    assistantMessage: {
      borderBottomLeftRadius: 6,
      marginRight: spacing.xl,
      gap: spacing.xs,
    },
  });
