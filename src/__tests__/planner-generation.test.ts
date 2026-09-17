import type { PlannerInput, PlannerProvider } from '@/features/planner';
import { generatePlannerProposal } from '@/features/planner';

const taskId = '11111111-1111-4111-8111-111111111111';

const input: PlannerInput = {
  calendarEvents: [],
  date: '2026-09-17',
  freeSlots: [
    {
      durationMinutes: 60,
      endAt: '2026-09-17T00:00:00.000Z',
      startAt: '2026-09-16T23:00:00.000Z',
    },
  ],
  goals: [],
  planningWindow: {
    endAt: '2026-09-17T00:00:00.000Z',
    startAt: '2026-09-16T23:00:00.000Z',
  },
  tasks: [
    {
      deadline: null,
      estimatedMinutes: 30,
      goalId: null,
      id: taskId,
      priority: 'medium',
      status: 'pending',
      title: '復習',
    },
  ],
  timezone: 'Asia/Tokyo',
};

function createProvider(candidate: unknown): PlannerProvider & { generate: jest.Mock } {
  return {
    generate: jest.fn(async () => candidate),
    id: 'test-provider',
  };
}

describe('generatePlannerProposal', () => {
  it('passes the input to the Provider and validates its unknown output', async () => {
    const provider = createProvider({
      actions: [
        {
          endAt: '2026-09-17T08:30:00+09:00',
          reason: '今日の優先Taskのため',
          startAt: '2026-09-17T08:00:00+09:00',
          taskId,
          title: '復習',
        },
      ],
      date: '2026-09-17',
      summary: '朝に復習します。',
      unscheduled: [],
    });

    const result = await generatePlannerProposal(provider, input);

    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(provider.generate).toHaveBeenCalledWith(input);
    expect(result).toEqual({
      ok: true,
      proposal: expect.objectContaining({
        actions: [
          expect.objectContaining({
            endAt: '2026-09-16T23:30:00.000Z',
            startAt: '2026-09-16T23:00:00.000Z',
          }),
        ],
      }),
      warnings: [],
    });
  });

  it('returns validation errors for malformed Provider output', async () => {
    const result = await generatePlannerProposal(createProvider('not a proposal'), input);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation to fail.');
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'INVALID_STRUCTURE', path: '$' }),
    ]);
  });

  it('does not hide Provider execution failures as validation errors', async () => {
    const failure = new Error('provider unavailable');
    const provider: PlannerProvider = {
      generate: jest.fn(async () => Promise.reject(failure)),
      id: 'failing-provider',
    };

    await expect(generatePlannerProposal(provider, input)).rejects.toBe(failure);
  });
});
