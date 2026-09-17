import type {
  PlannerInput,
  PlannerProposal,
  PlannerValidationIssueCode,
  PlannerValidationResult,
} from '@/features/planner';
import { validatePlannerProposal } from '@/features/planner';

const firstTaskId = '11111111-1111-4111-8111-111111111111';
const secondTaskId = '22222222-2222-4222-8222-222222222222';
const goalId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const input: PlannerInput = {
  calendarEvents: [],
  date: '2026-09-17',
  freeSlots: [
    {
      durationMinutes: 120,
      endAt: '2026-09-17T01:00:00.000Z',
      startAt: '2026-09-16T23:00:00.000Z',
    },
    {
      durationMinutes: 60,
      endAt: '2026-09-17T03:00:00.000Z',
      startAt: '2026-09-17T02:00:00.000Z',
    },
  ],
  goals: [
    {
      currentValue: 530,
      deadline: '2026-10-25',
      description: '英語学習',
      id: goalId,
      priority: 'high',
      targetValue: 730,
      title: 'TOEIC 730',
      unit: '点',
    },
  ],
  planningWindow: {
    endAt: '2026-09-17T03:00:00.000Z',
    startAt: '2026-09-16T23:00:00.000Z',
  },
  tasks: [
    {
      deadline: '2026-09-30',
      estimatedMinutes: 30,
      goalId,
      id: firstTaskId,
      priority: 'high',
      status: 'pending',
      title: 'Listening',
    },
    {
      deadline: null,
      estimatedMinutes: 60,
      goalId: null,
      id: secondTaskId,
      priority: 'medium',
      status: 'pending',
      title: '復習',
    },
  ],
  timezone: 'Asia/Tokyo',
};

function validProposal(): PlannerProposal {
  return {
    actions: [
      {
        endAt: '2026-09-17T08:30:00+09:00',
        reason: ' 期限が近いため ',
        startAt: '2026-09-17T08:00:00+09:00',
        taskId: firstTaskId,
        title: ' Listening ',
      },
    ],
    date: '2026-09-17',
    summary: ' 朝に学習します。 ',
    unscheduled: [{ reason: '空き時間が不足しています。', taskId: secondTaskId }],
  };
}

function expectErrorCode(result: PlannerValidationResult, code: PlannerValidationIssueCode): void {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected validation to fail.');
  expect(result.errors.map((error) => error.code)).toContain(code);
}

describe('Planner proposal validation', () => {
  it('accepts a complete proposal, trims text, and normalizes offset timestamps to UTC', () => {
    const result = validatePlannerProposal(validProposal(), input);

    expect(result).toEqual({
      ok: true,
      proposal: {
        actions: [
          {
            endAt: '2026-09-16T23:30:00.000Z',
            reason: '期限が近いため',
            startAt: '2026-09-16T23:00:00.000Z',
            taskId: firstTaskId,
            title: 'Listening',
          },
        ],
        date: '2026-09-17',
        summary: '朝に学習します。',
        unscheduled: [{ reason: '空き時間が不足しています。', taskId: secondTaskId }],
      },
      warnings: [],
    });
  });

  it('allows a task-free action without counting it toward Task coverage', () => {
    const proposal = validProposal();
    proposal.actions.push({
      endAt: '2026-09-17T11:15:00+09:00',
      reason: '集中を保つため',
      startAt: '2026-09-17T11:00:00+09:00',
      taskId: null,
      title: '休憩',
    });

    const result = validatePlannerProposal(proposal, input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected validation to succeed.');
    expect(result.proposal.actions[1].taskId).toBeNull();
  });

  it.each([null, 'invalid', 42, []])('rejects a non-object proposal: %p', (candidate) => {
    expectErrorCode(validatePlannerProposal(candidate, input), 'INVALID_STRUCTURE');
  });

  it('rejects missing proposal arrays at runtime', () => {
    const result = validatePlannerProposal({ date: input.date, summary: '計画します。' }, input);

    expectErrorCode(result, 'INVALID_STRUCTURE');
  });

  it('requires the proposal date to match the input date', () => {
    expectErrorCode(
      validatePlannerProposal({ ...validProposal(), date: '2026-09-18' }, input),
      'PROPOSAL_DATE_MISMATCH',
    );
  });

  it.each(['2026-09-17T08:00:00', '2026-02-30T08:00:00+09:00'])(
    'rejects an invalid action timestamp: %s',
    (startAt) => {
      const proposal = validProposal();
      proposal.actions[0].startAt = startAt;

      expectErrorCode(validatePlannerProposal(proposal, input), 'INVALID_TIMESTAMP');
    },
  );

  it('requires startAt to be before endAt', () => {
    const proposal = validProposal();
    proposal.actions[0].startAt = proposal.actions[0].endAt;

    expectErrorCode(validatePlannerProposal(proposal, input), 'INVALID_TIME_RANGE');
  });

  it('rejects an action outside the planning window', () => {
    const proposal = validProposal();
    proposal.actions[0].startAt = '2026-09-17T07:30:00+09:00';
    proposal.actions[0].endAt = '2026-09-17T08:00:00+09:00';

    expectErrorCode(validatePlannerProposal(proposal, input), 'ACTION_OUTSIDE_PLANNING_WINDOW');
  });

  it('rejects an action that crosses a gap between free slots', () => {
    const proposal = validProposal();
    proposal.actions[0].startAt = '2026-09-17T09:45:00+09:00';
    proposal.actions[0].endAt = '2026-09-17T10:15:00+09:00';

    expectErrorCode(validatePlannerProposal(proposal, input), 'ACTION_OUTSIDE_FREE_SLOT');
  });

  it('rejects overlapping actions using half-open intervals', () => {
    const taskFreeInput: PlannerInput = { ...input, tasks: [] };
    const result = validatePlannerProposal(
      {
        actions: [
          {
            endAt: '2026-09-17T09:00:00+09:00',
            reason: '一つ目',
            startAt: '2026-09-17T08:00:00+09:00',
            taskId: null,
            title: 'Action 1',
          },
          {
            endAt: '2026-09-17T09:30:00+09:00',
            reason: '二つ目',
            startAt: '2026-09-17T08:30:00+09:00',
            taskId: null,
            title: 'Action 2',
          },
        ],
        date: input.date,
        summary: '重複テスト',
        unscheduled: [],
      },
      taskFreeInput,
    );

    expectErrorCode(result, 'OVERLAPPING_ACTIONS');
  });

  it('allows actions whose half-open interval boundaries touch', () => {
    const taskFreeInput: PlannerInput = { ...input, tasks: [] };
    const result = validatePlannerProposal(
      {
        actions: [
          {
            endAt: '2026-09-17T08:30:00+09:00',
            reason: '一つ目',
            startAt: '2026-09-17T08:00:00+09:00',
            taskId: null,
            title: 'Action 1',
          },
          {
            endAt: '2026-09-17T09:00:00+09:00',
            reason: '二つ目',
            startAt: '2026-09-17T08:30:00+09:00',
            taskId: null,
            title: 'Action 2',
          },
        ],
        date: input.date,
        summary: '連続Action',
        unscheduled: [],
      },
      taskFreeInput,
    );

    expect(result.ok).toBe(true);
  });

  it('validates a non-null action taskId against PlannerInput.tasks', () => {
    const proposal = validProposal();
    proposal.actions[0].taskId = '33333333-3333-4333-8333-333333333333';

    expectErrorCode(validatePlannerProposal(proposal, input), 'UNKNOWN_TASK');
  });

  it('rejects a malformed non-null action taskId', () => {
    const proposal = validProposal();
    proposal.actions[0].taskId = 'task-1';

    expectErrorCode(validatePlannerProposal(proposal, input), 'INVALID_TASK_ID');
  });

  it('rejects scheduling one Task more than once', () => {
    const proposal = validProposal();
    proposal.actions.push({
      endAt: '2026-09-17T09:30:00+09:00',
      reason: '同じTaskの二回目',
      startAt: '2026-09-17T09:00:00+09:00',
      taskId: firstTaskId,
      title: 'Listening 2',
    });

    expectErrorCode(validatePlannerProposal(proposal, input), 'DUPLICATE_TASK_SCHEDULING');
  });

  it('rejects a Task appearing in both actions and unscheduled', () => {
    const proposal = validProposal();
    proposal.unscheduled.push({ reason: '重複', taskId: firstTaskId });

    expectErrorCode(validatePlannerProposal(proposal, input), 'TASK_SCHEDULED_AND_UNSCHEDULED');
  });

  it('requires every input Task to be scheduled or unscheduled exactly once', () => {
    expectErrorCode(
      validatePlannerProposal({ ...validProposal(), unscheduled: [] }, input),
      'TASK_COVERAGE',
    );
  });

  it.each([
    ['actions[0].title', { title: '   ' }],
    ['actions[0].reason', { reason: '' }],
  ])('rejects empty text at %s', (_path, override) => {
    const proposal = validProposal();
    proposal.actions[0] = { ...proposal.actions[0], ...override };

    expectErrorCode(validatePlannerProposal(proposal, input), 'EMPTY_TEXT');
  });

  it('rejects an empty unscheduled reason', () => {
    const proposal = validProposal();
    proposal.unscheduled[0].reason = '   ';

    expectErrorCode(validatePlannerProposal(proposal, input), 'EMPTY_TEXT');
  });

  it('accepts fractional-minute durations and warns when duration differs from the Task estimate', () => {
    const proposal = validProposal();
    proposal.actions[0].endAt = '2026-09-17T08:20:30+09:00';

    const result = validatePlannerProposal(proposal, input);

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'ESTIMATED_MINUTES_MISMATCH' }),
    ]);
  });

  it('uses freeSlots as authoritative even when Calendar events provide conflicting context', () => {
    const contextualInput: PlannerInput = {
      ...input,
      calendarEvents: [
        {
          endDate: '2026-09-18',
          kind: 'allDay',
          startDate: '2026-09-17',
          title: '空き時間扱いの終日予定',
        },
      ],
    };

    expect(validatePlannerProposal(validProposal(), contextualInput).ok).toBe(true);
  });
});
