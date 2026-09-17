import { getLocalDate, type LocalDate } from '@/features/today';

export function getPlannerTaskDeadlineDate(
  deadline: string | null,
  timezone: string,
): LocalDate | null {
  // The current Task schema stores an instant even though the UI captures a date only.
  // Normalize at the Planner boundary; this cannot recover dates already shifted on write.
  return deadline === null ? null : getLocalDate(deadline, timezone);
}
