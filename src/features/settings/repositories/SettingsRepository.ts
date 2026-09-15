export type ProfilePlanningSettings = {
  minimumFreeMinutes: number;
  planningEnd: string;
  planningStart: string;
  timezone: string;
};

export type UpdateProfilePlanningSettingsInput = ProfilePlanningSettings;

export interface SettingsRepository {
  getProfilePlanningSettings(): Promise<ProfilePlanningSettings>;
  updateProfilePlanningSettings(
    input: UpdateProfilePlanningSettingsInput,
  ): Promise<ProfilePlanningSettings>;
}
