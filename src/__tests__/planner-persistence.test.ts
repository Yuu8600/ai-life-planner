import {
  approvePlannerProposal,
  PlannerPersistenceMappingError,
  toSavePlannerProposalInput,
  type PlannerInput,
  type PlannerInputDependencies,
  type PlannerPersistenceRepository,
  type PlannerPreviewData,
  type PlannerProposal,
} from '@/features/planner';

const taskId = '11111111-1111-4111-8111-111111111111';
const unscheduledTaskId = '22222222-2222-4222-8222-222222222222';
const input: PlannerInput = {
  calendarEvents: [],
  date: '2026-09-18',
  freeSlots: [
    {
      durationMinutes: 60,
      endAt: '2026-09-18T01:00:00.000Z',
      startAt: '2026-09-18T00:00:00.000Z',
    },
  ],
  goals: [],
  planningWindow: {
    endAt: '2026-09-18T01:00:00.000Z',
    startAt: '2026-09-18T00:00:00.000Z',
  },
  tasks: [
    {
      deadline: null,
      estimatedMinutes: 30,
      goalId: null,
      id: taskId,
      priority: 'high',
      status: 'pending',
      title: '保存対象Task',
    },
    {
      deadline: null,
      estimatedMinutes: 90,
      goalId: null,
      id: unscheduledTaskId,
      priority: 'medium',
      status: 'pending',
      title: '未配置Task',
    },
  ],
  timezone: 'Asia/Tokyo',
};
const proposal: PlannerProposal = {
  actions: [
    {
      endAt: '2026-09-18T00:30:00.000Z',
      reason: '優先度が高いため',
      startAt: '2026-09-18T00:00:00.000Z',
      taskId,
      title: '保存対象Task',
    },
    {
      endAt: '2026-09-18T01:00:00.000Z',
      reason: '休憩を取るため',
      startAt: '2026-09-18T00:30:00.000Z',
      taskId: null,
      title: '休憩',
    },
  ],
  date: '2026-09-18',
  summary: '午前の計画です。',
  unscheduled: [{ reason: '空き時間不足', taskId: unscheduledTaskId }],
};

function preview(overrides: Partial<PlannerPreviewData> = {}): PlannerPreviewData {
  return { input, proposal, timezone: 'Asia/Tokyo', warnings: [], ...overrides };
}

describe('Planner persistence mapping', () => {
  it('maps only validated Proposal plan and action fields without changing UTC instants', () => {
    expect(toSavePlannerProposalInput(preview())).toEqual({
      actions: [
        {
          endAt: '2026-09-18T00:30:00.000Z',
          reason: '優先度が高いため',
          startAt: '2026-09-18T00:00:00.000Z',
          taskId,
          title: '保存対象Task',
        },
        {
          endAt: '2026-09-18T01:00:00.000Z',
          reason: '休憩を取るため',
          startAt: '2026-09-18T00:30:00.000Z',
          taskId: null,
          title: '休憩',
        },
      ],
      planDate: '2026-09-18',
      summary: '午前の計画です。',
      timezone: 'Asia/Tokyo',
    });
    expect(toSavePlannerProposalInput(preview())).not.toHaveProperty('unscheduled');
  });

  it('rejects a Preview whose validated date no longer matches its PlannerInput', () => {
    expect(() =>
      toSavePlannerProposalInput(preview({ proposal: { ...proposal, date: '2026-09-19' } })),
    ).toThrow(PlannerPersistenceMappingError);
  });

  it('passes the exact mapped Preview to the persistence repository', async () => {
    const repository: jest.Mocked<PlannerPersistenceRepository> = {
      savePlan: jest.fn(async (saveInput) => ({
        actionCount: saveInput.actions.length,
        id: '22222222-2222-4222-8222-222222222222',
        planDate: saveInput.planDate,
      })),
    };

    const dependencies: PlannerInputDependencies = {
      calendarRepository: {
        getPermission: async () => ({ canAskAgain: true, status: 'granted' }),
        listEvents: async () => ({ calendarCount: 1, discardedEventCount: 0, events: [] }),
        requestPermission: async () => ({ canAskAgain: true, status: 'granted' }),
      },
      goalRepository: { list: async () => [] },
      now: () => new Date('2026-09-18T00:00:00.000Z'),
      settingsRepository: {
        getProfilePlanningSettings: async () => ({
          minimumFreeMinutes: 20,
          planningStart: '09:00',
          planningEnd: '10:00',
          timezone: 'Asia/Tokyo',
        }),
        updateProfilePlanningSettings: async (settings) => settings,
      },
      taskRepository: { list: async () => [...input.tasks] },
    };
    await expect(approvePlannerProposal(repository, preview(), dependencies)).resolves.toEqual(
      expect.objectContaining({ actionCount: 2, planDate: '2026-09-18' }),
    );
    expect(repository.savePlan).toHaveBeenCalledWith(toSavePlannerProposalInput(preview()));
  });
});
