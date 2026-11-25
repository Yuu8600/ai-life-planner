export const policyLabels = {
  focus_goal: '目標を優先',
  focus_task: 'タスクを優先',
  prefer_short: '短時間を優先',
  lighter_day: '候補を絞る',
} as const;

export type PolicyKind = keyof typeof policyLabels;
export type PolicyFields = {
  policyKind: PolicyKind;
  startDate: string;
  endDate: string;
  targetGoalId?: string | null;
  targetTaskId?: string | null;
};

export type RecommendationPolicy = PolicyFields & {
  id: string;
  source: 'ai' | 'manual';
  status: 'active' | 'revoked';
  revision: number;
  createdAt: string;
  targetTitle?: string;
};

export function effectivePolicies(policies: readonly RecommendationPolicy[], date: string) {
  const relevant = policies
    .filter((item) => item.status === 'active' && item.startDate <= date && item.endDate >= date)
    .sort(
      (a, b) =>
        Number(b.source === 'manual') - Number(a.source === 'manual') ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.localeCompare(b.id),
    );
  const seen = new Set<string>();
  return relevant.filter((item) => {
    const key = JSON.stringify([
      item.policyKind,
      item.targetTaskId ?? null,
      item.targetGoalId ?? null,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
