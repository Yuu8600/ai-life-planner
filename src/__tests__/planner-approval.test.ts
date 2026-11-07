import type { CalendarEvent } from '@/features/calendar';
import {
  approvePlannerProposal,
  PlannerApprovalCheckError,
  PlannerPreviewStaleError,
  RuleBasedPlannerProvider,
  toSavePlannerProposalInput,
  type PlannerGoalSource,
  type PlannerInput,
  type PlannerInputDependencies,
  type PlannerPersistenceRepository,
  type PlannerTaskSource,
  PlannerReplanConflictError,
  type PlannerPlanSnapshot,
  type PlannerReplanRepository,
} from '@/features/planner';
import { generatePlannerPreview } from '@/features/planner/plannerPreview';

const taskId = '11111111-1111-4111-8111-111111111111';
const goalId = '22222222-2222-4222-8222-222222222222';
const planId = '33333333-3333-4333-8333-333333333333';

function scenario(providerId = 'openai') {
  const source = {
    now: new Date('2026-10-01T22:00:00.000Z'),
    settings: {
      calendarBufferBeforeMinutes: 0,
      calendarBufferAfterMinutes: 0,
      minimumFreeMinutes: 20,
      planningStart: '08:00',
      planningEnd: '10:00',
      timezone: 'Asia/Tokyo',
    },
    events: [] as CalendarEvent[],
    goals: [] as PlannerGoalSource[],
    tasks: [
      {
        deadline: null,
        estimatedMinutes: 30,
        goalId: null,
        id: taskId,
        priority: 'high',
        status: 'pending',
        title: 'Previewで確認したTask',
      },
    ] as PlannerTaskSource[],
  };
  const calendarRepository = {
    getPermission: jest.fn(async () => ({ canAskAgain: true, status: 'granted' as const })),
    listEvents: jest.fn(async () => ({
      calendarCount: 1,
      discardedEventCount: 0,
      events: source.events,
    })),
    requestPermission: jest.fn(async () => ({ canAskAgain: true, status: 'granted' as const })),
  };
  const goalRepository = { list: jest.fn(async () => source.goals) };
  const taskRepository = { list: jest.fn(async () => source.tasks) };
  const settingsRepository = {
    getProfilePlanningSettings: jest.fn(async () => source.settings),
    updateProfilePlanningSettings: jest.fn(
      async (
        settings: Parameters<
          PlannerInputDependencies['settingsRepository']['updateProfilePlanningSettings']
        >[0],
      ) => settings,
    ),
  };
  const dependencies: PlannerInputDependencies = {
    calendarRepository,
    goalRepository,
    now: () => source.now,
    settingsRepository,
    taskRepository,
  };
  // An OpenAI stub uses the same Contract; no remote transport is involved in these tests.
  const provider = {
    id: providerId,
    generate: jest.fn(async (input: PlannerInput) =>
      new RuleBasedPlannerProvider().generate(input),
    ),
  };
  const persistence: jest.Mocked<PlannerPersistenceRepository> = {
    savePlan: jest.fn(async (input) => ({
      actionCount: input.actions.length,
      id: planId,
      planDate: input.planDate,
    })),
  };
  const generate = async () => {
    const result = await generatePlannerPreview({ ...dependencies, provider });
    if (!result.ok) throw new Error('Expected a valid initial Preview.');
    return result;
  };
  return {
    source,
    dependencies,
    provider,
    persistence,
    generate,
    calendarRepository,
    goalRepository,
    taskRepository,
    settingsRepository,
  };
}

type Scenario = ReturnType<typeof scenario>;

const replanSnapshot: PlannerPlanSnapshot = {
  id: planId,
  planDate: '2026-10-02',
  summary: 'Old Plan',
  timezone: 'Asia/Tokyo',
  updatedAt: '2026-10-01T21:00:00.123456Z',
  actions: [{ id: goalId, status: 'scheduled', updatedAt: '2026-10-01T21:00:00.123456Z' }],
};

describe('Replanning uses the existing Provider-neutral pipeline', () => {
  function replanRepository(): jest.Mocked<PlannerReplanRepository> {
    return {
      getSnapshot: jest.fn<
        ReturnType<PlannerReplanRepository['getSnapshot']>,
        Parameters<PlannerReplanRepository['getSnapshot']>
      >(async () => replanSnapshot),
      replaceIfCurrent: jest.fn<
        ReturnType<PlannerReplanRepository['replaceIfCurrent']>,
        Parameters<PlannerReplanRepository['replaceIfCurrent']>
      >(async (input) => ({
        id: planId,
        actionCount: input.actions.length,
        planDate: input.planDate,
      })),
    };
  }
  it.each(['rule-based', 'openai'])(
    'captures a token before %s execution, then guards the SAME Proposal without another Provider call',
    async (id) => {
      const test = scenario(id);
      const replan = replanRepository();
      test.provider.generate.mockImplementation(async (input) => {
        expect(replan.getSnapshot).toHaveBeenCalledTimes(1);
        expect(input).not.toHaveProperty('expectedPlan');
        expect(input).not.toHaveProperty('existingActions');
        return new RuleBasedPlannerProvider().generate(input);
      });
      const preview = await generatePlannerPreview({
        ...test.dependencies,
        provider: test.provider,
        replanRepository: replan,
      });
      if (!preview.ok) throw new Error('Expected valid Replan');
      expect(replan.replaceIfCurrent).not.toHaveBeenCalled();
      expect(test.persistence.savePlan).not.toHaveBeenCalled();
      await approvePlannerProposal(test.persistence, preview, test.dependencies, undefined, replan);
      expect(replan.replaceIfCurrent).toHaveBeenCalledWith(
        toSavePlannerProposalInput(preview),
        replanSnapshot,
      );
      expect(test.provider.generate).toHaveBeenCalledTimes(1);
      expect(replan.getSnapshot).toHaveBeenCalledTimes(1);
      expect(test.persistence.savePlan).not.toHaveBeenCalled();
    },
  );
  it('never generates or falls back to normal saving when the Today Plan has disappeared', async () => {
    const test = scenario();
    const replan = replanRepository();
    replan.getSnapshot.mockResolvedValue(null);
    await expect(
      generatePlannerPreview({
        ...test.dependencies,
        provider: test.provider,
        replanRepository: replan,
      }),
    ).rejects.toThrow('Today Plan no longer exists');
    expect(test.provider.generate).not.toHaveBeenCalled();
    expect(test.persistence.savePlan).not.toHaveBeenCalled();
  });
  it('translates only DB concurrency conflicts to stale without changing the Proposal or retrying', async () => {
    const test = scenario();
    const replan = replanRepository();
    const preview = await generatePlannerPreview({
      ...test.dependencies,
      provider: test.provider,
      replanRepository: replan,
    });
    if (!preview.ok) throw new Error('Expected Replan');
    const original = preview.proposal;
    replan.replaceIfCurrent.mockRejectedValue(new PlannerReplanConflictError());
    await expect(
      approvePlannerProposal(test.persistence, preview, test.dependencies, undefined, replan),
    ).rejects.toBeInstanceOf(PlannerPreviewStaleError);
    expect(preview.proposal).toBe(original);
    expect(test.provider.generate).toHaveBeenCalledTimes(1);
    expect(test.persistence.savePlan).not.toHaveBeenCalled();
    expect(replan.replaceIfCurrent).toHaveBeenCalledTimes(1);
    const network = new Error('offline');
    replan.replaceIfCurrent.mockRejectedValue(network);
    await expect(
      approvePlannerProposal(test.persistence, preview, test.dependencies, undefined, replan),
    ).rejects.toBe(network);
  });
  it('runs the application stale check BEFORE guarded persistence', async () => {
    const test = scenario();
    const replan = replanRepository();
    const preview = await generatePlannerPreview({
      ...test.dependencies,
      provider: test.provider,
      replanRepository: replan,
    });
    if (!preview.ok) throw new Error('Expected Replan');
    test.source.tasks[0].status = 'completed';
    await expect(
      approvePlannerProposal(test.persistence, preview, test.dependencies, undefined, replan),
    ).rejects.toBeInstanceOf(PlannerPreviewStaleError);
    expect(replan.replaceIfCurrent).not.toHaveBeenCalled();
  });
  it('uses full pending Task estimates regardless of old Action time/status, without carrying free or final Actions', async () => {
    const test = scenario('rule-based');
    const replan = replanRepository();
    test.source.now = new Date('2026-10-01T23:15:23Z');
    const statuses = ['completed', 'skipped', 'scheduled', 'scheduled', 'scheduled'] as const;
    replan.getSnapshot.mockResolvedValue({
      ...replanSnapshot,
      actions: statuses.map((status, index) => ({
        id: `40000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        status,
        updatedAt: replanSnapshot.updatedAt,
      })),
    });
    test.source.tasks.push({ ...test.source.tasks[0], id: goalId, status: 'completed' });
    const preview = await generatePlannerPreview({
      ...test.dependencies,
      provider: test.provider,
      replanRepository: replan,
    });
    if (!preview.ok) throw new Error('Expected Replan');
    expect(preview.input.tasks.map((task) => task.id)).toEqual([taskId]);
    expect(preview.proposal.actions).toEqual([
      expect.objectContaining({
        taskId,
        startAt: '2026-10-01T23:16:00.000Z',
        endAt: '2026-10-01T23:46:00.000Z',
      }),
    ]);
    expect(replan.replaceIfCurrent).not.toHaveBeenCalled();
  });
});

async function expectStale(test: Scenario, change: () => void) {
  const preview = await test.generate();
  const originalProposal = preview.proposal;
  change();
  await expect(
    approvePlannerProposal(test.persistence, preview, test.dependencies),
  ).rejects.toBeInstanceOf(PlannerPreviewStaleError);
  expect(test.persistence.savePlan).not.toHaveBeenCalled();
  expect(test.provider.generate).toHaveBeenCalledTimes(1);
  expect(preview.proposal).toBe(originalProposal);
}

describe('Planner approval against current data', () => {
  it.each(['rule-based', 'openai'])(
    'saves the same valid %s Proposal after reloading all dependencies',
    async (providerId) => {
      const test = scenario(providerId);
      const preview = await test.generate();
      const original = toSavePlannerProposalInput(preview);

      await expect(
        approvePlannerProposal(test.persistence, preview, test.dependencies),
      ).resolves.toEqual({
        actionCount: 1,
        id: planId,
        planDate: '2026-10-02',
      });
      expect(test.persistence.savePlan).toHaveBeenCalledTimes(1);
      expect(test.persistence.savePlan).toHaveBeenCalledWith(original);
      expect(test.provider.generate).toHaveBeenCalledTimes(1);
      expect(test.settingsRepository.getProfilePlanningSettings).toHaveBeenCalledTimes(2);
      expect(test.calendarRepository.getPermission).toHaveBeenCalledTimes(2);
      expect(test.calendarRepository.listEvents).toHaveBeenCalledTimes(2);
      expect(test.goalRepository.list).toHaveBeenCalledTimes(2);
      expect(test.taskRepository.list).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['rule-based', 'openai'])(
    'refuses a %s Action whose start is now in the past',
    async (providerId) => {
      const test = scenario(providerId);
      await expectStale(test, () => {
        test.source.now = new Date('2026-10-01T23:00:00.001Z');
      });
    },
  );

  it('refuses when a new Calendar event consumes the free slot', async () => {
    const test = scenario();
    await expectStale(test, () => {
      test.source.events = [
        {
          allDay: false,
          allDayStartDate: null,
          allDayEndDate: null,
          availability: 'busy',
          calendarId: 'calendar-1',
          calendarTitle: '個人',
          id: 'new-event',
          instanceId: null,
          location: null,
          startAt: '2026-10-01T23:00:00.000Z',
          endAt: '2026-10-02T01:00:00.000Z',
          status: 'confirmed',
          timeZone: 'Asia/Tokyo',
          title: '新しい固定予定',
        },
      ];
    });
  });

  it('refuses when a referenced Task has been deleted', async () => {
    const test = scenario();
    await expectStale(test, () => {
      test.source.tasks = [];
    });
  });

  it.each(['completed', 'scheduled', 'skipped'] as const)(
    'refuses when a Task is now %s',
    async (status) => {
      const test = scenario();
      await expectStale(test, () => {
        test.source.tasks = test.source.tasks.map((task) => ({ ...task, status }));
      });
    },
  );

  it('refuses when new candidate Tasks are not covered by the displayed Proposal', async () => {
    const test = scenario();
    await expectStale(test, () => {
      test.source.tasks.push({ ...test.source.tasks[0], id: goalId, title: '追加Task' });
    });
  });

  it('refuses when the linked Goal becomes inactive', async () => {
    const test = scenario();
    test.source.goals = [
      {
        currentValue: null,
        deadline: null,
        description: null,
        id: goalId,
        priority: 'high',
        status: 'active',
        targetValue: null,
        title: 'Goal',
        unit: null,
      },
    ];
    test.source.tasks[0].goalId = goalId;
    await expectStale(test, () => {
      test.source.goals[0].status = 'completed';
    });
  });

  it('refuses when Settings move the Action outside the planning window', async () => {
    const test = scenario();
    await expectStale(test, () => {
      test.source.settings.planningStart = '09:00';
    });
  });

  it('refuses a timezone change even if the UTC intervals still match', async () => {
    const test = scenario();
    await expectStale(test, () => {
      test.source.settings.timezone = 'Asia/Seoul';
    });
  });

  it('refuses the previous Today date after local midnight', async () => {
    const test = scenario();
    await expectStale(test, () => {
      test.source.now = new Date('2026-10-02T15:00:00.000Z');
    });
  });

  it('uses the clock after dependency loading rather than an earlier approval timestamp', async () => {
    const test = scenario();
    const preview = await test.generate();
    test.taskRepository.list.mockImplementationOnce(async () => {
      test.source.now = new Date('2026-10-01T23:01:00.000Z');
      return test.source.tasks;
    });
    await expect(
      approvePlannerProposal(test.persistence, preview, test.dependencies),
    ).rejects.toBeInstanceOf(PlannerPreviewStaleError);
    expect(test.persistence.savePlan).not.toHaveBeenCalled();
  });

  it('treats local midnight reached during loading as stale', async () => {
    const test = scenario();
    const preview = await test.generate();
    test.taskRepository.list.mockImplementationOnce(async () => {
      test.source.now = new Date('2026-10-02T15:00:00.000Z');
      return test.source.tasks;
    });
    await expect(
      approvePlannerProposal(test.persistence, preview, test.dependencies),
    ).rejects.toBeInstanceOf(PlannerPreviewStaleError);
    expect(test.persistence.savePlan).not.toHaveBeenCalled();
  });

  it('fails closed with a distinct check error when data cannot be reloaded', async () => {
    const test = scenario();
    const preview = await test.generate();
    test.taskRepository.list.mockRejectedValueOnce(new Error('offline'));
    await expect(
      approvePlannerProposal(test.persistence, preview, test.dependencies),
    ).rejects.toBeInstanceOf(PlannerApprovalCheckError);
    expect(test.persistence.savePlan).not.toHaveBeenCalled();
    expect(test.provider.generate).toHaveBeenCalledTimes(1);
  });

  it('does not save a retired approval after its data loading completes', async () => {
    const test = scenario();
    const preview = await test.generate();
    await expect(
      approvePlannerProposal(test.persistence, preview, test.dependencies, () => false),
    ).rejects.toThrow('cancelled');
    expect(test.persistence.savePlan).not.toHaveBeenCalled();
  });

  it('keeps actual atomic persistence errors separate from stale validation', async () => {
    const test = scenario();
    const preview = await test.generate();
    const persistenceError = new Error('RPC unavailable');
    test.persistence.savePlan.mockRejectedValueOnce(persistenceError);
    await expect(approvePlannerProposal(test.persistence, preview, test.dependencies)).rejects.toBe(
      persistenceError,
    );
    expect(test.persistence.savePlan).toHaveBeenCalledTimes(1);
    expect(test.provider.generate).toHaveBeenCalledTimes(1);
  });
});

it.each(['rule-based', 'openai'])(
  'uses latest buffers for %s validation, stale approval and regeneration',
  async (id) => {
    const test = scenario(id);
    test.source.events = [
      {
        allDay: false,
        allDayStartDate: null,
        allDayEndDate: null,
        availability: 'busy',
        status: 'confirmed',
        calendarId: 'cal',
        calendarTitle: null,
        id: 'event',
        instanceId: null,
        location: null,
        timeZone: null,
        title: 'meeting',
        startAt: '2026-10-01T23:30:00Z',
        endAt: '2026-10-02T00:00:00Z',
      },
    ];
    const preview = await test.generate();
    expect(preview.proposal.actions[0].startAt).toBe('2026-10-01T23:00:00.000Z');
    test.source.settings.calendarBufferBeforeMinutes = 15;
    test.source.settings.calendarBufferAfterMinutes = 30;
    await expect(
      approvePlannerProposal(test.persistence, preview, test.dependencies),
    ).rejects.toBeInstanceOf(PlannerPreviewStaleError);
    expect(test.persistence.savePlan).not.toHaveBeenCalled();
    expect(preview.proposal.actions[0].startAt).toBe('2026-10-01T23:00:00.000Z');
    const fresh = await test.generate();
    expect(fresh.proposal.actions[0].startAt).toBe('2026-10-02T00:30:00.000Z');
    await approvePlannerProposal(test.persistence, fresh, test.dependencies);
    expect(test.persistence.savePlan).toHaveBeenCalledTimes(1);
    const replanned = await generatePlannerPreview({
      ...test.dependencies,
      provider: test.provider,
      replanRepository: {
        getSnapshot: jest.fn(async () => replanSnapshot),
        replaceIfCurrent: jest.fn(),
      },
    });
    expect(replanned.ok && replanned.proposal.actions[0].startAt).toBe('2026-10-02T00:30:00.000Z');
    // A provider returning the old, unbuffered placement must fail common validation.
    test.provider.generate.mockResolvedValueOnce(preview.proposal);
    const invalid = await generatePlannerPreview({ ...test.dependencies, provider: test.provider });
    expect(invalid.ok).toBe(false);
  },
);
