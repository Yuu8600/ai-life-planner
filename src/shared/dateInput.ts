export const FIRST_DATE_INPUT = '0001-01-01';
export const LAST_DATE_INPUT = '9999-12-31';

export function formatDateInput(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateInputToLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  // Use local calendar fields so the picker never shifts a selected day through UTC.
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date;
}
