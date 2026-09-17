import {
  generatePlannerProposal,
  RuleBasedPlannerProvider,
  type FreeTimeSlot,
  type PlannerInput,
  type PlannerTask,
} from '@/features/planner';
import { schedulePlannerTasks } from '@/features/planner/schedulePlannerTasks';

const firstTaskId = '11111111-1111-4111-8111-111111111111';
const secondTaskId = '22222222-2222-4222-8222-222222222222';
const thirdTaskId = '33333333-3333-4333-8333-333333333333';

function task(id: string, estimatedMinutes: number, title = `Task ${id}`): PlannerTask {
  return {
    deadline: null,
    estimatedMinutes,
    goalId: null,
    id,
    priority: 'medium',
    status: 'pending',
    title,
  };
}

function slot(startAt: string, endAt: string): FreeTimeSlot {
  return {
    durationMinutes: (Date.parse(endAt) - Date.parse(startAt)) / 60_000,
    endAt,
    startAt,
  };
}

function input(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    calendarEvents: [],
    date: '2026-09-17',
    freeSlots: [slot('2026-09-16T23:00:00.000Z', '2026-09-17T01:00:00.000Z')],
    goals: [],
    planningWindow: {
      endAt: '2026-09-17T06:00:00.000Z',
      startAt: '2026-09-16T23:00:00.000Z',
    },
    tasks: [task(firstTaskId, 30, '復習')],
    timezone: 'Asia/Tokyo',
    ...overrides,
  };
}

describe('RuleBasedPlannerProvider scheduling', () => {
  it('places one Task at the start of the earliest slot for its exact estimated duration', () => {
    const proposal = schedulePlannerTasks(input());

    expect(proposal.actions).toEqual([
      expect.objectContaining({
        endAt: '2026-09-16T23:30:00.000Z',
        startAt: '2026-09-16T23:00:00.000Z',
        taskId: firstTaskId,
        title: '復習',
      }),
    ]);
    expect(proposal.unscheduled).toEqual([]);
  });

  it('consumes one slot from its start and places later Tasks on touching boundaries', () => {
    const proposal = schedulePlannerTasks(
      input({
        tasks: [task(firstTaskId, 30), task(secondTaskId, 45), task(thirdTaskId, 45)],
      }),
    );

    expect(proposal.actions.map(({ startAt, endAt }) => [startAt, endAt])).toEqual([
      ['2026-09-16T23:00:00.000Z', '2026-09-16T23:30:00.000Z'],
      ['2026-09-16T23:30:00.000Z', '2026-09-17T00:15:00.000Z'],
      ['2026-09-17T00:15:00.000Z', '2026-09-17T01:00:00.000Z'],
    ]);
  });

  it('preserves Task priority order while applying first-fit across multiple slots', () => {
    const proposal = schedulePlannerTasks(
      input({
        freeSlots: [
          slot('2026-09-17T04:00:00.000Z', '2026-09-17T06:00:00.000Z'),
          slot('2026-09-16T23:00:00.000Z', '2026-09-17T01:00:00.000Z'),
        ],
        tasks: [task(firstTaskId, 60), task(secondTaskId, 90), task(thirdTaskId, 30)],
      }),
    );

    expect(
      proposal.actions.map(({ taskId, startAt, endAt }) => ({ taskId, startAt, endAt })),
    ).toEqual([
      {
        endAt: '2026-09-17T00:00:00.000Z',
        startAt: '2026-09-16T23:00:00.000Z',
        taskId: firstTaskId,
      },
      {
        endAt: '2026-09-17T05:30:00.000Z',
        startAt: '2026-09-17T04:00:00.000Z',
        taskId: secondTaskId,
      },
      {
        endAt: '2026-09-17T00:30:00.000Z',
        startAt: '2026-09-17T00:00:00.000Z',
        taskId: thirdTaskId,
      },
    ]);
  });

  it('accepts an exact fit without splitting the Task', () => {
    const proposal = schedulePlannerTasks(
      input({
        freeSlots: [slot('2026-09-17T01:00:00.000Z', '2026-09-17T02:00:00.000Z')],
        tasks: [task(firstTaskId, 60)],
      }),
    );

    expect(proposal.actions).toHaveLength(1);
    expect(proposal.actions[0]).toMatchObject({
      endAt: '2026-09-17T02:00:00.000Z',
      startAt: '2026-09-17T01:00:00.000Z',
      taskId: firstTaskId,
    });
  });

  it('does not combine fragmented slots even when their total duration is sufficient', () => {
    const proposal = schedulePlannerTasks(
      input({
        freeSlots: [
          slot('2026-09-16T23:00:00.000Z', '2026-09-16T23:30:00.000Z'),
          slot('2026-09-17T01:00:00.000Z', '2026-09-17T01:30:00.000Z'),
          slot('2026-09-17T03:00:00.000Z', '2026-09-17T03:30:00.000Z'),
        ],
        tasks: [task(firstTaskId, 90)],
      }),
    );

    expect(proposal.actions).toEqual([]);
    expect(proposal.unscheduled).toEqual([
      expect.objectContaining({ reason: expect.stringContaining('連続'), taskId: firstTaskId }),
    ]);
  });

  it('marks every Task unscheduled when no free slot exists', () => {
    const proposal = schedulePlannerTasks(
      input({
        freeSlots: [],
        tasks: [task(firstTaskId, 30), task(secondTaskId, 30)],
      }),
    );

    expect(proposal.actions).toEqual([]);
    expect(proposal.unscheduled.map(({ taskId }) => taskId)).toEqual([firstTaskId, secondTaskId]);
  });

  it('keeps an oversized Task unscheduled and still places a later Task that fits', () => {
    const proposal = schedulePlannerTasks(
      input({
        freeSlots: [slot('2026-09-16T23:00:00.000Z', '2026-09-17T00:00:00.000Z')],
        tasks: [task(firstTaskId, 90), task(secondTaskId, 60)],
      }),
    );

    expect(proposal.actions.map(({ taskId }) => taskId)).toEqual([secondTaskId]);
    expect(proposal.unscheduled.map(({ taskId }) => taskId)).toEqual([firstTaskId]);
    expect(proposal.summary).toEqual(expect.stringMatching(/1件.*1件/));
  });

  it('covers each input Task exactly once without task-free or duplicate actions', () => {
    const plannerInput = input({
      freeSlots: [slot('2026-09-16T23:00:00.000Z', '2026-09-17T00:00:00.000Z')],
      tasks: [task(firstTaskId, 30), task(secondTaskId, 60), task(thirdTaskId, 30)],
    });
    const proposal = schedulePlannerTasks(plannerInput);
    const actionTaskIds = proposal.actions.map(({ taskId }) => taskId);
    const unscheduledTaskIds = proposal.unscheduled.map(({ taskId }) => taskId);

    expect(actionTaskIds).not.toContain(null);
    expect(new Set(actionTaskIds).size).toBe(actionTaskIds.length);
    expect(new Set(unscheduledTaskIds).size).toBe(unscheduledTaskIds.length);
    expect(
      actionTaskIds.filter((taskId) => taskId !== null && unscheduledTaskIds.includes(taskId)),
    ).toEqual([]);
    expect([...actionTaskIds, ...unscheduledTaskIds].sort()).toEqual(
      plannerInput.tasks.map(({ id }) => id).sort(),
    );
  });

  it('uses existing instants directly and emits normalized UTC across a Tokyo date boundary', () => {
    const proposal = schedulePlannerTasks(
      input({
        date: '2026-09-18',
        freeSlots: [slot('2026-09-18T00:00:00+09:00', '2026-09-18T01:00:00+09:00')],
        planningWindow: {
          endAt: '2026-09-18T01:00:00+09:00',
          startAt: '2026-09-18T00:00:00+09:00',
        },
        tasks: [task(firstTaskId, 30)],
      }),
    );

    expect(proposal.actions[0]).toMatchObject({
      endAt: '2026-09-17T15:30:00.000Z',
      startAt: '2026-09-17T15:00:00.000Z',
    });
  });

  it('returns a valid empty proposal and deterministic summary for zero Tasks', () => {
    const proposal = schedulePlannerTasks(input({ tasks: [] }));

    expect(proposal).toEqual({
      actions: [],
      date: '2026-09-17',
      summary: expect.any(String),
      unscheduled: [],
    });
    expect(proposal.summary.trim()).not.toBe('');
  });

  it('returns the same proposal for the same input without mutating free slots', () => {
    const plannerInput = input({
      tasks: [task(firstTaskId, 60), task(secondTaskId, 60), task(thirdTaskId, 30)],
    });
    const freeSlotsBefore = JSON.parse(JSON.stringify(plannerInput.freeSlots));

    expect(schedulePlannerTasks(plannerInput)).toEqual(schedulePlannerTasks(plannerInput));
    expect(plannerInput.freeSlots).toEqual(freeSlotsBefore);
  });

  it('does not use Calendar context to change placement availability', () => {
    const withoutContext = input();
    const withContext = input({
      calendarEvents: [
        {
          endDate: '2026-09-18',
          kind: 'allDay',
          startDate: '2026-09-17',
          title: '終日予定',
        },
      ],
    });

    expect(schedulePlannerTasks(withContext)).toEqual(schedulePlannerTasks(withoutContext));
  });
});

describe('RuleBasedPlannerProvider integration', () => {
  it('has a stable Provider ID and passes its output through generatePlannerProposal validation', async () => {
    const provider = new RuleBasedPlannerProvider();
    const result = await generatePlannerProposal(
      provider,
      input({
        freeSlots: [slot('2026-09-16T23:00:00.000Z', '2026-09-17T00:00:00.000Z')],
        planningWindow: {
          endAt: '2026-09-17T00:00:00.000Z',
          startAt: '2026-09-16T23:00:00.000Z',
        },
        tasks: [task(firstTaskId, 30), task(secondTaskId, 60)],
      }),
    );

    expect(provider.id).toBe('rule-based');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected RuleBased Planner output to pass validation.');
    expect(result.warnings).toEqual([]);
    expect(result.proposal.actions.map(({ taskId }) => taskId)).toEqual([firstTaskId]);
    expect(result.proposal.unscheduled.map(({ taskId }) => taskId)).toEqual([secondTaskId]);
  });
});
