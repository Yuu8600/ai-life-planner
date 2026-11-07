import type { CalendarEvent, CalendarRepository } from '@/features/calendar';
import {
  RuleBasedPlannerProvider,
  type PlannerInput,
  type PlannerProvider,
} from '@/features/planner';
import {
  generatePlannerPreview,
  PlannerPreviewProviderError,
  type PlannerPreviewGoalRepository,
  type PlannerPreviewTaskRepository,
} from '@/features/planner/plannerPreview';
import { toPlannerPreviewViewModel } from '@/features/planner/plannerPreviewPresentation';
import type { SettingsRepository } from '@/features/settings';

const oversizedTaskId = '11111111-1111-4111-8111-111111111111';
const shortTaskId = '22222222-2222-4222-8222-222222222222';
const now = () => new Date('2026-09-16T15:30:00.000Z');
const settings = {
  calendarBufferBeforeMinutes: 0,
  calendarBufferAfterMinutes: 0,
  minimumFreeMinutes: 20,
  planningEnd: '10:00',
  planningEndDayOffset: 0 as const,
  planningStart: '08:00',
  timezone: 'Asia/Tokyo',
};

const oversizedTask = {
  deadline: null,
  estimatedMinutes: 180,
  goalId: null,
  id: oversizedTaskId,
  priority: 'high' as const,
  status: 'pending' as const,
  title: '長時間Task',
};

const shortTask = {
  deadline: null,
  estimatedMinutes: 30,
  goalId: null,
  id: shortTaskId,
  priority: 'medium' as const,
  status: 'pending' as const,
  title: '朝の復習',
};

const blockingAllDayEvent: CalendarEvent = {
  allDay: true,
  allDayEndDate: '2026-09-18',
  allDayStartDate: '2026-09-17',
  availability: 'busy',
  calendarId: 'calendar-1',
  calendarTitle: '個人',
  endAt: '2026-09-17T15:00:00.000Z',
  id: 'all-day-event',
  instanceId: null,
  location: null,
  startAt: '2026-09-16T15:00:00.000Z',
  status: 'confirmed',
  timeZone: 'Asia/Tokyo',
  title: '終日予定',
};

function createCalendarRepository(events: CalendarEvent[] = []): jest.Mocked<CalendarRepository> {
  return {
    getPermission: jest.fn<
      ReturnType<CalendarRepository['getPermission']>,
      Parameters<CalendarRepository['getPermission']>
    >(async () => ({ canAskAgain: true, status: 'granted' })),
    listEvents: jest.fn<
      ReturnType<CalendarRepository['listEvents']>,
      Parameters<CalendarRepository['listEvents']>
    >(async () => ({ calendarCount: 1, discardedEventCount: 0, events })),
    requestPermission: jest.fn<
      ReturnType<CalendarRepository['requestPermission']>,
      Parameters<CalendarRepository['requestPermission']>
    >(async () => ({ canAskAgain: true, status: 'granted' })),
  };
}

function createSettingsRepository(): jest.Mocked<SettingsRepository> {
  return {
    getProfilePlanningSettings: jest.fn(async () => settings),
    updateProfilePlanningSettings: jest.fn(async (input) => input),
  };
}

function createGoalRepository(): jest.Mocked<PlannerPreviewGoalRepository> {
  return { list: jest.fn(async () => []) };
}

function createTaskRepository(
  tasks = [oversizedTask, shortTask],
): jest.Mocked<PlannerPreviewTaskRepository> {
  return { list: jest.fn(async () => tasks) };
}

function dependencies(
  provider: PlannerProvider = new RuleBasedPlannerProvider(),
  calendarRepository = createCalendarRepository(),
  taskRepository = createTaskRepository(),
) {
  return {
    calendarRepository,
    goalRepository: createGoalRepository(),
    now,
    provider,
    settingsRepository: createSettingsRepository(),
    taskRepository,
  };
}

describe('Planner Preview orchestration', () => {
  it('passes the same clipped availability to RuleBased and an OpenAI-shaped Provider', async () => {
    const duringPlanning = () => new Date('2026-09-17T00:14:23.000Z');
    const ruleBased = await generatePlannerPreview({
      ...dependencies(),
      now: duringPlanning,
    });
    const openAiStub: PlannerProvider = {
      id: 'openai',
      generate: jest.fn(async (input: PlannerInput) =>
        new RuleBasedPlannerProvider().generate(input),
      ),
    };
    const openAi = await generatePlannerPreview({
      ...dependencies(openAiStub),
      now: duringPlanning,
    });

    expect(ruleBased.ok).toBe(true);
    expect(openAi.ok).toBe(true);
    if (!ruleBased.ok || !openAi.ok) throw new Error('Expected validated previews.');

    const expectedFreeSlots = [
      {
        startAt: '2026-09-17T00:15:00.000Z',
        endAt: '2026-09-17T01:00:00.000Z',
        durationMinutes: 45,
      },
    ];
    expect(ruleBased.input.freeSlots).toEqual(expectedFreeSlots);
    expect(openAi.input.freeSlots).toEqual(expectedFreeSlots);
    expect(openAiStub.generate).toHaveBeenCalledWith(openAi.input);
    expect(ruleBased.input.planningWindow).toEqual({
      startAt: '2026-09-16T23:00:00.000Z',
      endAt: '2026-09-17T01:00:00.000Z',
    });
    expect(ruleBased.proposal.actions[0].startAt).toBe('2026-09-17T00:15:00.000Z');
    expect(openAi.proposal.actions[0].startAt).toBe('2026-09-17T00:15:00.000Z');
  });

  it('rejects an external Provider action placed in a past part of the planning window', async () => {
    const pastProvider: PlannerProvider = {
      id: 'openai',
      generate: jest.fn(async () => ({
        actions: [
          {
            endAt: '2026-09-16T23:30:00.000Z',
            reason: '過去の時間を使っています。',
            startAt: '2026-09-16T23:00:00.000Z',
            taskId: shortTaskId,
            title: shortTask.title,
          },
        ],
        date: '2026-09-17',
        summary: '1件を配置しました。',
        unscheduled: [{ reason: '時間が足りません。', taskId: oversizedTaskId }],
      })),
    };
    const result = await generatePlannerPreview({
      ...dependencies(pastProvider),
      now: () => new Date('2026-09-17T00:14:23.000Z'),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected an invalid past action.');
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'ACTION_OUTSIDE_FREE_SLOT' }),
    );
  });

  it('runs the real Planner pipeline for the profile-local Today date', async () => {
    const calendarRepository = createCalendarRepository();
    const result = await generatePlannerPreview(
      dependencies(new RuleBasedPlannerProvider(), calendarRepository),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected preview generation to succeed.');
    expect(result.input.date).toBe('2026-09-17');
    expect(result.timezone).toBe('Asia/Tokyo');
    expect(calendarRepository.listEvents).toHaveBeenCalledWith(
      {
        endAt: '2026-09-17T15:00:00.000Z',
        startAt: '2026-09-16T15:00:00.000Z',
      },
      '2026-09-17',
    );
    expect(result.proposal.actions.map(({ taskId }) => taskId)).toEqual([shortTaskId]);
    expect(result.proposal.unscheduled.map(({ taskId }) => taskId)).toEqual([oversizedTaskId]);
  });

  it('formats actions in profile timezone and resolves unscheduled Task titles', async () => {
    const result = await generatePlannerPreview(dependencies());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected preview generation to succeed.');
    const preview = toPlannerPreviewViewModel(result);

    expect(preview.actions).toEqual([
      expect.objectContaining({
        reason: expect.stringContaining('最も早い空き時間'),
        timeRange: '08:00–08:30',
        title: '朝の復習',
      }),
    ]);
    expect(preview.unscheduled).toEqual([
      expect.objectContaining({
        reason: expect.stringContaining('連続'),
        taskId: oversizedTaskId,
        title: '長時間Task',
      }),
    ]);
  });

  it('treats zero Tasks as a successful empty preview', async () => {
    const result = await generatePlannerPreview(
      dependencies(
        new RuleBasedPlannerProvider(),
        createCalendarRepository(),
        createTaskRepository([]),
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected empty preview generation to succeed.');
    expect(result.proposal.actions).toEqual([]);
    expect(result.proposal.unscheduled).toEqual([]);
  });

  it('treats zero free slots and zero candidates as a successful empty preview', async () => {
    const result = await generatePlannerPreview(
      dependencies(new RuleBasedPlannerProvider(), createCalendarRepository([blockingAllDayEvent])),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected no-free-time preview generation to succeed.');
    expect(result.input.freeSlots).toEqual([]);
    expect(result.input.tasks).toEqual([]);
    expect(result.proposal.actions).toEqual([]);
    expect(result.proposal.unscheduled).toEqual([]);
  });

  it('distinguishes Provider execution errors from validation failures', async () => {
    const throwingProvider: PlannerProvider = {
      generate: jest.fn(async () => Promise.reject(new Error('provider failed'))),
      id: 'throwing-provider',
    };
    const invalidProvider: PlannerProvider = {
      generate: jest.fn(async () => 'invalid proposal'),
      id: 'invalid-provider',
    };

    await expect(generatePlannerPreview(dependencies(throwingProvider))).rejects.toBeInstanceOf(
      PlannerPreviewProviderError,
    );

    const invalidResult = await generatePlannerPreview(dependencies(invalidProvider));
    expect(invalidResult.ok).toBe(false);
    if (invalidResult.ok) throw new Error('Expected validation failure.');
    expect(invalidResult.issues).toEqual([
      expect.objectContaining({ code: 'INVALID_STRUCTURE', path: '$' }),
    ]);
  });

  it('keeps a validated Proposal previewable when warnings are present', async () => {
    const warningProvider: PlannerProvider = {
      generate: jest.fn(async () => ({
        actions: [
          {
            endAt: '2026-09-16T23:20:00.000Z',
            reason: '警告確認用の配置です。',
            startAt: '2026-09-16T23:00:00.000Z',
            taskId: shortTaskId,
            title: shortTask.title,
          },
        ],
        date: '2026-09-17',
        summary: '1件を配置しました。',
        unscheduled: [],
      })),
      id: 'warning-provider',
    };
    const result = await generatePlannerPreview(
      dependencies(warningProvider, createCalendarRepository(), createTaskRepository([shortTask])),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected warning proposal to remain valid.');
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'ESTIMATED_MINUTES_MISMATCH' }),
    ]);
    expect(toPlannerPreviewViewModel(result).actions).toHaveLength(1);
  });
});
