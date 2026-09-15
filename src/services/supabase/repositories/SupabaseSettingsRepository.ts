import type { SupabaseClient } from '@supabase/supabase-js';

import { ProfileNotFoundError } from '@/features/settings/errors';
import type {
  ProfilePlanningSettings,
  SettingsRepository,
  UpdateProfilePlanningSettingsInput,
} from '@/features/settings/repositories/SettingsRepository';

import { getSupabaseClient } from '../client';
import type { Database } from '../database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type ProfilePlanningSettingsRow = Pick<
  ProfileRow,
  'id' | 'minimum_free_minutes' | 'planning_end' | 'planning_start' | 'timezone'
>;

const DATABASE_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d{1,6})?)?$/;

function toMinutePrecision(value: string): string {
  const match = DATABASE_TIME_PATTERN.exec(value);

  if (!match) throw new Error('Unexpected profile planning time data');
  return `${match[1]}:${match[2]}`;
}

function toProfilePlanningSettings(
  row: ProfilePlanningSettingsRow,
  expectedUserId: string,
): ProfilePlanningSettings {
  if (
    row.id !== expectedUserId ||
    typeof row.timezone !== 'string' ||
    !Number.isInteger(row.minimum_free_minutes) ||
    row.minimum_free_minutes <= 0
  ) {
    throw new Error('Unexpected profile planning settings data');
  }

  return {
    minimumFreeMinutes: row.minimum_free_minutes,
    planningEnd: toMinutePrecision(row.planning_end),
    planningStart: toMinutePrecision(row.planning_start),
    timezone: row.timezone,
  };
}

function toProfileUpdate(input: UpdateProfilePlanningSettingsInput): ProfileUpdate {
  return {
    minimum_free_minutes: input.minimumFreeMinutes,
    planning_end: `${input.planningEnd}:00`,
    planning_start: `${input.planningStart}:00`,
    timezone: input.timezone,
  };
}

export class SupabaseSettingsRepository implements SettingsRepository {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly userId: string,
  ) {}

  async getProfilePlanningSettings(): Promise<ProfilePlanningSettings> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id, timezone, planning_start, planning_end, minimum_free_minutes')
      .eq('id', this.userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new ProfileNotFoundError();
    return toProfilePlanningSettings(data, this.userId);
  }

  async updateProfilePlanningSettings(
    input: UpdateProfilePlanningSettingsInput,
  ): Promise<ProfilePlanningSettings> {
    const { data, error } = await this.client
      .from('profiles')
      .update(toProfileUpdate(input))
      .eq('id', this.userId)
      .select('id, timezone, planning_start, planning_end, minimum_free_minutes')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new ProfileNotFoundError();
    return toProfilePlanningSettings(data, this.userId);
  }
}

export function createSupabaseSettingsRepository(userId: string): SettingsRepository {
  return new SupabaseSettingsRepository(getSupabaseClient(), userId);
}
