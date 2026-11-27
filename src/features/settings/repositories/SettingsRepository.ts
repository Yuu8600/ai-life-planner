export type ProfilePlanningSettings = {
  calendarBufferBeforeMinutes: number;
  calendarBufferAfterMinutes: number;
  minimumFreeMinutes: number;
  planningEnd: string;
  planningEndDayOffset: 0 | 1;
  planningStart: string;
  timezone: string;
  taskGapMinutes?: number;
};

export type UpdateProfilePlanningSettingsInput = ProfilePlanningSettings;

export interface SettingsRepository {
  getProfilePlanningSettings(): Promise<ProfilePlanningSettings>;
  updateProfilePlanningSettings(
    input: UpdateProfilePlanningSettingsInput,
  ): Promise<ProfilePlanningSettings>;
}
