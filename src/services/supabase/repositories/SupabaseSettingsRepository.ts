import { createSettingsFormValues, validateSettingsForm } from '@/features/settings/validation';
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
  | 'calendar_buffer_before_minutes'
  | 'calendar_buffer_after_minutes'
  | 'id'
  | 'minimum_free_minutes'
  | 'planning_end_day_offset'
  | 'planning_end'
  | 'planning_start'
  | 'timezone'
> & { v2_task_gap_minutes?: number };

const PROFILE_COLUMNS =
  'id, timezone, planning_start, planning_end, minimum_free_minutes, planning_end_day_offset, calendar_buffer_before_minutes, calendar_buffer_after_minutes' as const;
const V2_PROFILE_COLUMNS =
  'id, timezone, planning_start, planning_end, minimum_free_minutes, planning_end_day_offset, calendar_buffer_before_minutes, calendar_buffer_after_minutes, v2_task_gap_minutes' as const;

const DATABASE_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d{1,6})?)?$/;

function toMinutePrecision(value: string): string {
  const match = DATABASE_TIME_PATTERN.exec(value);

  if (!match) throw new Error('Unexpected profile planning time data');
  return `${match[1]}:${match[2]}`;
}

function toProfilePlanningSettings(
  row: ProfilePlanningSettingsRow,
  expectedUserId: string,
  includeTaskGap = false,
): ProfilePlanningSettings {
  if (
    (includeTaskGap &&
      (typeof row.v2_task_gap_minutes !== 'number' ||
        !Number.isInteger(row.v2_task_gap_minutes) ||
        row.v2_task_gap_minutes < 0 ||
        row.v2_task_gap_minutes > 240)) ||
    row.id !== expectedUserId ||
    (row.planning_end_day_offset !== 0 && row.planning_end_day_offset !== 1) ||
    !Number.isInteger(row.calendar_buffer_before_minutes) ||
    row.calendar_buffer_before_minutes < 0 ||
    row.calendar_buffer_before_minutes > 240 ||
    !Number.isInteger(row.calendar_buffer_after_minutes) ||
    row.calendar_buffer_after_minutes < 0 ||
    row.calendar_buffer_after_minutes > 240 ||
    typeof row.timezone !== 'string' ||
    !Number.isInteger(row.minimum_free_minutes) ||
    row.minimum_free_minutes <= 0
  ) {
    throw new Error('Unexpected profile planning settings data');
  }

  return {
    calendarBufferBeforeMinutes: row.calendar_buffer_before_minutes,
    calendarBufferAfterMinutes: row.calendar_buffer_after_minutes,
    minimumFreeMinutes: row.minimum_free_minutes,
    planningEnd: toMinutePrecision(row.planning_end),
    planningEndDayOffset: row.planning_end_day_offset as 0 | 1,
    planningStart: toMinutePrecision(row.planning_start),
    timezone: row.timezone,
    ...(includeTaskGap ? { taskGapMinutes: row.v2_task_gap_minutes } : {}),
  };
}

function toProfileUpdate(input: UpdateProfilePlanningSettingsInput): ProfileUpdate {
  return {
    calendar_buffer_before_minutes: input.calendarBufferBeforeMinutes,
    calendar_buffer_after_minutes: input.calendarBufferAfterMinutes,
    minimum_free_minutes: input.minimumFreeMinutes,
    planning_end: `${input.planningEnd}:00`,
    planning_end_day_offset: input.planningEndDayOffset,
    planning_start: `${input.planningStart}:00`,
    timezone: input.timezone,
    ...(input.taskGapMinutes === undefined ? {} : { v2_task_gap_minutes: input.taskGapMinutes }),
  };
}

export class SupabaseSettingsRepository implements SettingsRepository {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly userId: string,
    private readonly includeTaskGap = false,
  ) {}

  async getProfilePlanningSettings(): Promise<ProfilePlanningSettings> {
    const query = this.client.from('profiles');
    const selected = this.includeTaskGap
      ? query.select(V2_PROFILE_COLUMNS)
      : query.select(PROFILE_COLUMNS);
    const { data, error } = await selected.eq('id', this.userId).maybeSingle();

    if (error) throw error;
    if (!data) throw new ProfileNotFoundError();
    return toProfilePlanningSettings(data, this.userId, this.includeTaskGap);
  }

  async updateProfilePlanningSettings(
    input: UpdateProfilePlanningSettingsInput,
  ): Promise<ProfilePlanningSettings> {
    if (
      (this.includeTaskGap && input.taskGapMinutes === undefined) ||
      (!this.includeTaskGap && input.taskGapMinutes !== undefined)
    )
      throw new Error('Unexpected task gap setting');
    const validated = validateSettingsForm(createSettingsFormValues(input));
    if (!validated.input) throw new Error('Invalid profile planning settings');
    const query = this.client
      .from('profiles')
      .update(toProfileUpdate(validated.input))
      .eq('id', this.userId);
    const result = this.includeTaskGap
      ? query.select(V2_PROFILE_COLUMNS)
      : query.select(PROFILE_COLUMNS);
    const { data, error } = await result.maybeSingle();

    if (error) throw error;
    if (!data) throw new ProfileNotFoundError();
    return toProfilePlanningSettings(data, this.userId, this.includeTaskGap);
  }
}

export function createSupabaseSettingsRepository(
  userId: string,
  options: { includeTaskGap?: boolean } = {},
): SettingsRepository {
  return new SupabaseSettingsRepository(
    getSupabaseClient(),
    userId,
    options.includeTaskGap ?? false,
  );
}
