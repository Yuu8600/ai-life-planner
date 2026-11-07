import {
  createSettingsFormValues,
  type SettingsFormValues,
  validateSettingsForm,
} from '@/features/settings/validation';

const validValues: SettingsFormValues = {
  calendarBufferBeforeHours: '0',
  calendarBufferBeforeMinutes: '0',
  calendarBufferAfterHours: '0',
  calendarBufferAfterMinutes: '0',
  minimumFreeMinutes: '30',
  planningEnd: '22:30',
  planningStart: '08:15',
  timezone: ' Asia/Tokyo ',
};

describe('Settings validation', () => {
  it('normalizes valid values into repository input', () => {
    expect(validateSettingsForm(validValues)).toEqual({
      errors: null,
      input: {
        calendarBufferBeforeMinutes: 0,
        calendarBufferAfterMinutes: 0,
        minimumFreeMinutes: 30,
        planningEnd: '22:30',
        planningStart: '08:15',
        timezone: 'Asia/Tokyo',
      },
    });
  });

  it('converts loaded profile settings into editable strings', () => {
    expect(
      createSettingsFormValues({
        calendarBufferBeforeMinutes: 0,
        calendarBufferAfterMinutes: 0,
        minimumFreeMinutes: 20,
        planningEnd: '23:00',
        planningStart: '08:00',
        timezone: 'Asia/Tokyo',
      }),
    ).toEqual({
      calendarBufferBeforeHours: '0',
      calendarBufferBeforeMinutes: '0',
      calendarBufferAfterHours: '0',
      calendarBufferAfterMinutes: '0',
      minimumFreeMinutes: '20',
      planningEnd: '23:00',
      planningStart: '08:00',
      timezone: 'Asia/Tokyo',
    });
  });

  it.each(['', 'Mars/Olympus', 'Asia Tokyo'])(
    'rejects an invalid IANA timezone: %s',
    (timezone) => {
      const result = validateSettingsForm({ ...validValues, timezone });

      expect(result.input).toBeNull();
      expect(result.errors?.timezone).toBeTruthy();
    },
  );

  it.each(['8:00', '08:0', '24:00', '12:60', '08:00:00'])(
    'rejects an invalid planning time: %s',
    (planningStart) => {
      const result = validateSettingsForm({ ...validValues, planningStart });

      expect(result.errors?.planningStart).toBe('開始時刻はHH:mm形式で入力してください。');
    },
  );

  it('validates the planning end format independently', () => {
    const result = validateSettingsForm({ ...validValues, planningEnd: '22:30:00' });

    expect(result.errors?.planningEnd).toBe('終了時刻はHH:mm形式で入力してください。');
  });

  it.each([
    ['08:00', '08:00'],
    ['22:00', '08:00'],
  ])('rejects a non-increasing planning window: %s - %s', (planningStart, planningEnd) => {
    const result = validateSettingsForm({ ...validValues, planningEnd, planningStart });

    expect(result.errors?.planningEnd).toBe('終了時刻は開始時刻より後にしてください。');
  });

  it.each(['', '0', '-1', '1.5', '20分', '2147483648'])(
    'rejects invalid minimum free minutes: %s',
    (minimumFreeMinutes) => {
      const result = validateSettingsForm({ ...validValues, minimumFreeMinutes });

      expect(result.errors?.minimumFreeMinutes).toBe('1以上の整数で入力してください。');
    },
  );
});

it.each([
  [0, 0, 0],
  [0, 15, 15],
  [1, 30, 90],
  [2, 0, 120],
  [4, 0, 240],
])('converts %ih %im into %i minutes', (hours, minutes, total) => {
  const result = validateSettingsForm({
    ...validValues,
    calendarBufferBeforeHours: String(hours),
    calendarBufferBeforeMinutes: String(minutes),
    calendarBufferAfterHours: String(hours),
    calendarBufferAfterMinutes: String(minutes),
  });
  expect(result.input?.calendarBufferBeforeMinutes).toBe(total);
  expect(result.input?.calendarBufferAfterMinutes).toBe(total);
});
it.each([
  ['-1', '0'],
  ['0', '-1'],
  ['0', '1.5'],
  ['1.5', '0'],
  ['5', '0'],
  ['4', '1'],
  ['0', '60'],
  ['', '0'],
  ['0', ''],
  ['x', '0'],
  ['0', '15分'],
])('rejects invalid buffer hours=%s minutes=%s', (hours, minutes) => {
  const result = validateSettingsForm({
    ...validValues,
    calendarBufferBeforeHours: hours,
    calendarBufferBeforeMinutes: minutes,
    calendarBufferAfterHours: hours,
    calendarBufferAfterMinutes: minutes,
  });
  expect(result.input).toBeNull();
  expect(result.errors?.calendarBufferBeforeMinutes).toBeTruthy();
  expect(result.errors?.calendarBufferAfterMinutes).toBeTruthy();
});
