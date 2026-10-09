import { executePlannedAction, type PlannedActionExecutionRepository } from '@/features/today';

describe('Action Execution use case', () => {
  it.each(['completed', 'skipped'] as const)(
    'maps a scheduled Action to %s',
    async (targetStatus) => {
      const transition = jest.fn(async () => {});
      await executePlannedAction(
        { transition },
        { id: 'action', status: 'scheduled' },
        targetStatus,
      );
      expect(transition).toHaveBeenCalledWith({ actionId: 'action', targetStatus });
    },
  );

  it.each([
    ['completed', 'skipped'],
    ['skipped', 'completed'],
    ['completed', 'scheduled'],
    ['skipped', 'scheduled'],
  ] as const)('rejects %s → %s without writing', async (from, to) => {
    const transition = jest.fn(async () => {});
    await expect(
      executePlannedAction({ transition }, { id: 'action', status: from }, to as 'completed'),
    ).rejects.toThrow('Unsupported');
    expect(transition).not.toHaveBeenCalled();
  });

  it.each(['completed', 'skipped'] as const)(
    'lets the authenticated repository own %s replay semantics',
    async (status) => {
      const transition = jest.fn(async () => {});
      await executePlannedAction({ transition }, { id: 'action', status }, status);
      expect(transition).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects a blank id and propagates transaction failure', async () => {
    const failure = new Error('RPC rolled back');
    const repository: PlannedActionExecutionRepository = {
      transition: jest.fn(async () => {
        throw failure;
      }),
    };
    await expect(
      executePlannedAction(repository, { id: '', status: 'scheduled' }, 'completed'),
    ).rejects.toThrow('Unsupported');
    expect(repository.transition).not.toHaveBeenCalled();
    await expect(
      executePlannedAction(repository, { id: 'action', status: 'scheduled' }, 'completed'),
    ).rejects.toBe(failure);
  });
});
