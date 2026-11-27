import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import {
  ActivityLogSection,
  useActivityLogs,
  type ActivityLogRepository,
} from '@/features/activity';
import { formatPlanningTime, type TodayDailyPlan } from '@/features/today';
import { ActionButton } from '@/shared/components/ActionButton';
import { Card } from '@/shared/components/Card';
import { Notice } from '@/shared/components/Notice';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { spacing, useThemeColors } from '@/shared/theme';

export type LegacyPlanHistoryRepository = {
  getPlanForDate(date: string): Promise<TodayDailyPlan | null>;
};

export function LegacyPlanHistory({
  date,
  plans,
  activities,
}: {
  date: string;
  plans: LegacyPlanHistoryRepository;
  activities: ActivityLogRepository;
}) {
  const colors = useThemeColors();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<
    { kind: 'loading' | 'error' } | { kind: 'loaded'; plan: TodayDailyPlan | null }
  >({ kind: 'loading' });
  const logs = useActivityLogs(activities, date);

  useEffect(() => {
    let active = true;
    void plans.getPlanForDate(date).then(
      (plan) => {
        if (active) setState({ kind: 'loaded', plan });
      },
      () => {
        if (active) setState({ kind: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [plans, date, attempt]);

  const plan = state.kind === 'loaded' ? state.plan : null;
  const empty =
    state.kind === 'loaded' && !plan && logs.state.status === 'success' && !logs.state.logs.length;
  if (empty) return <Notice tone="info" message="この日の旧計画・実行履歴はありません。" />;
  return (
    <Card style={{ gap: spacing.sm }}>
      <SectionHeader title="以前の方式で保存した計画" />
      {state.kind === 'loading' ? (
        <Text style={{ color: colors.textSecondary }}>計画を読み込んでいます。</Text>
      ) : null}
      {state.kind === 'error' ? (
        <>
          <Notice tone="error" message="過去の計画を読み込めませんでした。" />
          <ActionButton
            label="計画を再読み込み"
            variant="secondary"
            onPress={() => {
              setState({ kind: 'loading' });
              setAttempt((value) => value + 1);
            }}
          />
        </>
      ) : null}
      {state.kind === 'loaded' && !plan?.actions.length ? (
        <Text style={{ color: colors.textSecondary }}>この日の旧計画に作業枠はありません。</Text>
      ) : null}
      {plan?.summary ? <Text style={{ color: colors.textPrimary }}>{plan.summary}</Text> : null}
      {plan?.actions.map((item) => (
        <Text key={item.id} style={{ color: colors.textPrimary }}>
          {formatPlanningTime(item.startAt, date, plan.timezone)}〜
          {formatPlanningTime(item.endAt, date, plan.timezone)}　{item.title}　
          {item.status === 'completed' ? '完了' : item.status === 'skipped' ? 'スキップ' : '予定'}
        </Text>
      ))}
      <ActivityLogSection title="以前の方式の実行履歴" state={logs.state} onRetry={logs.retry} />
    </Card>
  );
}
