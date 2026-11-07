import type { CalendarEvent } from './types';
export type CalendarEventBufferKey = {
  calendarId: string;
  eventId: string;
  occurrenceStartAt: string;
};
export type CalendarEventBufferOverride = CalendarEventBufferKey & {
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
};
export interface CalendarEventBufferRepository {
  list(): Promise<CalendarEventBufferOverride[]>;
  upsert(value: CalendarEventBufferOverride): Promise<void>;
  remove(key: CalendarEventBufferKey): Promise<void>;
}
export function eventBufferKey(
  event: Pick<CalendarEvent, 'calendarId' | 'id' | 'startAt'>,
): CalendarEventBufferKey {
  return {
    calendarId: event.calendarId,
    eventId: event.id,
    occurrenceStartAt: new Date(event.startAt).toISOString(),
  };
}
export function bufferKey(value: CalendarEventBufferKey): string {
  if (!value.calendarId || !value.eventId || !Number.isFinite(Date.parse(value.occurrenceStartAt)))
    throw new Error('Invalid Calendar occurrence key');
  return JSON.stringify([
    value.calendarId,
    value.eventId,
    new Date(value.occurrenceStartAt).toISOString(),
  ]);
}
export function validateEventBuffer(value: CalendarEventBufferOverride): void {
  bufferKey(value);
  for (const minutes of [value.bufferBeforeMinutes, value.bufferAfterMinutes]) {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240)
      throw new Error('Calendar buffers must be integers from 0 to 240');
  }
}
export function effectiveEventBuffers(
  event: Pick<CalendarEvent, 'calendarId' | 'id' | 'startAt'>,
  before: number,
  after: number,
  overrides: readonly CalendarEventBufferOverride[],
) {
  const key = bufferKey(eventBufferKey(event));
  const individual = overrides.find((value) => bufferKey(value) === key);
  if (individual) validateEventBuffer(individual);
  return {
    before: individual ? individual.bufferBeforeMinutes : before,
    after: individual ? individual.bufferAfterMinutes : after,
  };
}
export async function loadEventBuffers(repository?: CalendarEventBufferRepository | null) {
  if (repository === null) throw new Error('Calendar buffer repository unavailable');
  const values = repository ? await repository.list() : [];
  values.forEach(validateEventBuffer);
  if (new Set(values.map(bufferKey)).size !== values.length)
    throw new Error('Duplicate Calendar buffer overrides');
  return values;
}
