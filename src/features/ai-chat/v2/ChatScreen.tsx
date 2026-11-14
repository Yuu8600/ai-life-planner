import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { Card } from '@/shared/components/Card';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { colors, spacing, typography } from '@/shared/theme';
import { DraftEditor } from './DraftEditor';
import type { ChatRepository, Draft, PlanProposal, Thread, Usage } from './repository';

export function ChatScreen({
  repository,
  reviewPlan,
}: {
  repository: ChatRepository;
  reviewPlan: (plan: PlanProposal) => void;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [newTitle, setNewTitle] = useState<string>();
  const [current, setCurrent] = useState<Thread>();
  const [conversation, setConversation] = useState<Awaited<ReturnType<ChatRepository['open']>>>();
  const [usage, setUsage] = useState<Usage>();
  const [usageFailed, setUsageFailed] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [date, setDate] = useState('');
  const [workingDraft, setWorkingDraft] = useState<Draft>();
  const [referencedDraft, setReferencedDraft] = useState<string>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);

  const refreshUsage = useCallback(async () => {
    try {
      setUsage(await repository.usage());
      setUsageFailed(false);
    } catch {
      setUsage(undefined);
      setUsageFailed(true);
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
      setConversation(await repository.open(id));
    },
    [repository],
  );
  useEffect(() => {
    if (!current) return;
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
    setCurrent(thread);
    setConversation(undefined);
    setPrompt('');
    setDate('');
    setReferencedDraft(undefined);
    setError('');
  };
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
    if (!current || !prompt.trim() || lock.current) return;
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
    try {
      await repository.send(current.id, prompt.trim(), date || undefined, referencedDraft);
      setPrompt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'メッセージを送信できませんでした。');
    } finally {
      await Promise.all([refreshConversation(current.id).catch(() => undefined), refreshUsage()]);
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <AppScreen contentContainerStyle={{ gap: spacing.md }}>
      <ScreenHeader
        title={current?.title ?? 'AI相談'}
        action={
          current ? (
            <ActionButton
              label="会話一覧"
              variant="secondary"
              disabled={pending}
              onPress={() => open()}
            />
          ) : (
            <ActionButton label="新規会話" loading={pending} onPress={() => setNewTitle('')} />
          )
        }
      />
      {usage ? (
        <Text style={{ color: colors.textSecondary }}>
          {usage.configured
            ? `残り推定 $${(usage.remainingMicros / 1_000_000).toFixed(3)} / $0.50（UTC月ごと）`
            : 'AIは未設定です。'}
          {'\n'}実際のOpenAI請求額を保証する上限ではありません。
        </Text>
      ) : usageFailed ? (
        <View>
          <Notice
            tone="warning"
            message="AIの接続と残り予算を確認できません。会話や下書きは閲覧できます。"
          />
          <ActionButton
            label="AIの接続を再確認"
            variant="ghost"
            onPress={() => void refreshUsage()}
          />
        </View>
      ) : null}
      {error ? <Notice tone="error" message={error} /> : null}
      {current ? (
        <>
          {conversation?.messages.map((item) => (
            <Card key={item.id}>
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
                {draft.approvedAt ? '承認済み' : '提案の下書き'}　
                {draft.items.map((item) => item.title).join('、')}
              </Text>
              <ActionButton
                label="下書きを開く"
                variant="secondary"
                disabled={pending}
                onPress={() => setWorkingDraft(draft)}
              />
              {!draft.approvedAt ? (
                <ActionButton
                  label={
                    referencedDraft === draft.id
                      ? 'この下書きへの相談を解除'
                      : 'この下書きについて相談'
                  }
                  variant="ghost"
                  disabled={pending}
                  onPress={() =>
                    setReferencedDraft(referencedDraft === draft.id ? undefined : draft.id)
                  }
                />
              ) : null}
            </Card>
          ))}
          <FormField
            label="相談内容"
            helper={referencedDraft ? '選択した下書きの最新版を添えて送信します。' : undefined}
          >
            <FormInput
              multiline
              value={prompt}
              editable={!pending}
              maxLength={1000}
              onChangeText={setPrompt}
            />
          </FormField>
          <FormField label="相談する日（任意・YYYY-MM-DD）">
            <FormInput value={date} editable={!pending} maxLength={10} onChangeText={setDate} />
          </FormField>
          <ActionButton
            label="AIに送信"
            loading={pending}
            disabled={!usage?.configured || usage.remainingMicros === 0 || !prompt.trim()}
            onPress={() => void send()}
          />
          {workingDraft ? (
            <DraftEditor
              key={workingDraft.id}
              draft={workingDraft}
              repository={repository}
              close={() => setWorkingDraft(undefined)}
              refreshed={() => refreshConversation(current.id)}
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
            disabled={pending}
            onPress={() => open(thread)}
          />
        ))
      )}
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
  );
}
