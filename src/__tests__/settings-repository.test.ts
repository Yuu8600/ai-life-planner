import type { SupabaseClient } from '@supabase/supabase-js';

import { ProfileNotFoundError } from '@/features/settings/errors';
import type {
  SettingsRepository,
  UpdateProfilePlanningSettingsInput,
} from '@/features/settings/repositories/SettingsRepository';
import type { Database } from '@/services/supabase/database.types';
import { SupabaseSettingsRepository } from '@/services/supabase/repositories/SupabaseSettingsRepository';

jest.mock('@/services/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '99999999-9999-4999-8999-999999999999';

const profileRow: ProfileRow = {
  created_at: '2026-09-11T00:00:00+00:00',
  display_name: null,
  id: userId,
  calendar_buffer_before_minutes: 0,
  calendar_buffer_after_minutes: 0,
  minimum_free_minutes: 20,
  planning_end: '23:00:00',
  planning_start: '08:00:00',
  timezone: 'Asia/Tokyo',
  updated_at: '2026-09-11T00:00:00+00:00',
};

const updateInput: UpdateProfilePlanningSettingsInput = {
  calendarBufferBeforeMinutes: 0,
  calendarBufferAfterMinutes: 0,
  minimumFreeMinutes: 30,
  planningEnd: '21:45',
  planningStart: '09:15',
  timezone: 'America/New_York',
};

type Builder = {
  eq: jest.Mock;
  maybeSingle: jest.Mock;
  select: jest.Mock;
  update: jest.Mock;
};

function createBuilder(response: { data: unknown; error: unknown }): Builder {
  const builder = {} as Builder;
  builder.eq = jest.fn(() => builder);
  builder.maybeSingle = jest.fn(async () => response);
  builder.select = jest.fn(() => builder);
  builder.update = jest.fn(() => builder);
  return builder;
}

function createRepository(builder: Builder) {
  const from = jest.fn(() => builder);
  const client = { from } as unknown as SupabaseClient<Database>;
  const repository: SettingsRepository = new SupabaseSettingsRepository(client, userId);
  return { builder, from, repository };
}

describe('SupabaseSettingsRepository', () => {
  it('loads the signed-in user profile and converts database time values to HH:mm', async () => {
    const { builder, from, repository } = createRepository(
      createBuilder({ data: profileRow, error: null }),
    );

    await expect(repository.getProfilePlanningSettings()).resolves.toEqual({
      calendarBufferBeforeMinutes: 0,
      calendarBufferAfterMinutes: 0,
      minimumFreeMinutes: 20,
      planningEnd: '23:00',
      planningStart: '08:00',
      timezone: 'Asia/Tokyo',
    });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(builder.eq).toHaveBeenCalledWith('id', userId);
  });

  it('updates only the planning fields on the signed-in user profile', async () => {
    const updatedRow = {
      ...profileRow,
      calendar_buffer_before_minutes: 0,
      calendar_buffer_after_minutes: 0,
      minimum_free_minutes: 30,
      planning_end: '21:45:00',
      planning_start: '09:15:00',
      timezone: 'America/New_York',
    };
    const { builder, repository } = createRepository(
      createBuilder({ data: updatedRow, error: null }),
    );

    await expect(repository.updateProfilePlanningSettings(updateInput)).resolves.toEqual(
      updateInput,
    );
    expect(builder.update).toHaveBeenCalledWith({
      calendar_buffer_before_minutes: 0,
      calendar_buffer_after_minutes: 0,
      minimum_free_minutes: 30,
      planning_end: '21:45:00',
      planning_start: '09:15:00',
      timezone: 'America/New_York',
    });
    expect(builder.eq).toHaveBeenCalledWith('id', userId);
    expect(builder.update.mock.calls[0][0]).not.toHaveProperty('display_name');
    expect(builder.update.mock.calls[0][0]).not.toHaveProperty('id');
  });

  it('rejects a row belonging to another user even if a malformed backend returns it', async () => {
    const { repository } = createRepository(
      createBuilder({ data: { ...profileRow, id: otherUserId }, error: null }),
    );

    await expect(repository.getProfilePlanningSettings()).rejects.toThrow(
      'Unexpected profile planning settings data',
    );
  });

  it('reports a missing profile instead of treating an update as successful', async () => {
    const { repository } = createRepository(createBuilder({ data: null, error: null }));

    await expect(repository.updateProfilePlanningSettings(updateInput)).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
  });

  it('propagates RLS and Supabase errors to the feature error boundary', async () => {
    const error = { code: '42501', message: 'row-level security' };
    const { repository } = createRepository(createBuilder({ data: null, error }));

    await expect(repository.getProfilePlanningSettings()).rejects.toBe(error);
  });
});

it('saves and reloads nonzero buffer fields with the owner filter', async () => {
  const row = {
    ...profileRow,
    calendar_buffer_before_minutes: 90,
    calendar_buffer_after_minutes: 240,
  };
  const { repository, builder } = createRepository(createBuilder({ data: row, error: null }));
  const input = {
    ...updateInput,
    calendarBufferBeforeMinutes: 90,
    calendarBufferAfterMinutes: 240,
  };
  const updated = await repository.updateProfilePlanningSettings(input);
  expect(updated.calendarBufferBeforeMinutes).toBe(90);
  expect(updated.calendarBufferAfterMinutes).toBe(240);
  expect(builder.update).toHaveBeenCalledWith(
    expect.objectContaining({
      calendar_buffer_before_minutes: 90,
      calendar_buffer_after_minutes: 240,
    }),
  );
  expect(builder.eq).toHaveBeenCalledWith('id', userId);
  expect((await repository.getProfilePlanningSettings()).calendarBufferAfterMinutes).toBe(240);
});
it.each([-1, 241, 0.5, NaN])('rejects invalid buffers before a DB write: %s', async (minutes) => {
  const { repository, builder } = createRepository(
    createBuilder({ data: profileRow, error: null }),
  );
  await expect(
    repository.updateProfilePlanningSettings({
      ...updateInput,
      calendarBufferBeforeMinutes: minutes,
    }),
  ).rejects.toThrow();
  expect(builder.update).not.toHaveBeenCalled();
});
