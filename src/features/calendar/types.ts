export type CalendarItemKind = 'calendar' | 'planned';

export type CalendarItem = {
  endMinutes: number;
  endTime: string;
  id: string;
  kind: CalendarItemKind;
  startMinutes: number;
  startTime: string;
  title: string;
};
