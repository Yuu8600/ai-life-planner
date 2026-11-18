import { policyLabels, type PolicyKind } from '@/features/recommendations/policy';
import {
  isEffort,
  type ActionStep,
  type RecommendationRepository,
  type StepInput,
} from '@/features/recommendations/repository';

import { getSupabaseClient } from '../client';
import type { Database } from '../database.types';

type StepRow = Database['public']['Tables']['action_steps']['Row'];

function toStep(row: StepRow): ActionStep {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    minutes: row.estimated_minutes,
    effort: isEffort(row.effort) ? row.effort : null,
    repeatable: row.repeatable,
    completed: row.completed_at !== null,
    createdAt: row.created_at,
  };
}

function fields(input: StepInput) {
  return {
    title: input.title,
    estimated_minutes: input.minutes,
    effort: input.effort,
    repeatable: input.repeatable,
  };
}

export function createSupabaseRecommendationRepository(userId: string): RecommendationRepository {
  const client = getSupabaseClient();
  return {
    async listPolicies(date) {
      const { data, error } = await client
        .from('recommendation_policies')
        .select('*,goals(title),tasks(title)')
        .eq('user_id', userId)
        .lte('start_date', date)
        .gte('end_date', date);
      if (error) throw error;
      return data.flatMap((row) => {
        if (
          !Object.hasOwn(policyLabels, row.policy_kind) ||
          (row.source !== 'ai' && row.source !== 'manual') ||
          (row.status !== 'active' && row.status !== 'revoked')
        )
          return [];
        return [
          {
            id: row.id,
            policyKind: row.policy_kind as PolicyKind,
            startDate: row.start_date,
            endDate: row.end_date,
            targetGoalId: row.target_goal_id,
            targetTaskId: row.target_task_id,
            source: row.source,
            status: row.status,
            revision: row.revision,
            createdAt: row.created_at,
            targetTitle: row.goals?.title ?? row.tasks?.title ?? undefined,
          },
        ];
      });
    },
    async setPolicyActive(id, revision, active) {
      const { error } = await client.rpc('v26_policy_status', {
        p_id: id,
        p_revision: revision,
        p_active: active,
      });
      if (error) throw error;
    },
    async listSteps(taskId) {
      const steps: ActionStep[] = [];
      const size = 500;
      for (let offset = 0; ; offset += size) {
        const query = client.from('action_steps').select('*').eq('user_id', userId);
        const { data, error } = await (taskId ? query.eq('task_id', taskId) : query)
          .order('created_at')
          .order('id')
          .range(offset, offset + size - 1);
        if (error) throw error;
        steps.push(...data.map(toStep));
        if (data.length < size) return steps;
      }
    },
    async listResults(from, through) {
      const results: Awaited<ReturnType<RecommendationRepository['listResults']>> = [];
      const size = 500;
      for (let offset = 0; ; offset += size) {
        const { data, error } = await client
          .from('recommendation_results')
          .select('*')
          .eq('user_id', userId)
          .gte('local_date', from)
          .lte('local_date', through)
          .order('local_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('target_kind')
          .order('target_id')
          .range(offset, offset + size - 1);
        if (error) throw error;
        for (const row of data) {
          if (
            (row.target_kind !== 'task' && row.target_kind !== 'step') ||
            (row.outcome !== 'completed' && row.outcome !== 'skipped')
          )
            throw new Error('Unexpected recommendation result');
          results.push({
            date: row.local_date,
            kind: row.target_kind,
            targetId: row.target_id,
            taskId: row.task_id,
            goalId: row.goal_id,
            title: row.title,
            outcome: row.outcome,
          });
        }
        if (data.length < size) return results;
      }
    },
    async addStep(taskId, input) {
      const { data, error } = await client
        .from('action_steps')
        .insert({ task_id: taskId, ...fields(input) })
        .select()
        .single();
      if (error) throw error;
      return toStep(data);
    },
    async updateStep(id, input) {
      const { data, error } = await client
        .from('action_steps')
        .update(fields(input))
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return toStep(data);
    },
    async removeStep(id) {
      const { error } = await client
        .from('action_steps')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
    },
    async undo(date, kind, id, expected) {
      const { error } = await client.rpc('undo_recommendation_result', {
        p_date: date,
        p_kind: kind,
        p_id: id,
        p_expected: expected,
      });
      if (error) throw error;
    },
    async record(date, kind, id, outcome) {
      const { data, error } = await client.rpc('record_recommendation_result', {
        p_date: date,
        p_kind: kind,
        p_id: id,
        p_outcome: outcome,
      });
      if (error) throw error;
      if (data !== 'completed' && data !== 'skipped') throw new Error('Unexpected result');
      return data;
    },
  };
}
