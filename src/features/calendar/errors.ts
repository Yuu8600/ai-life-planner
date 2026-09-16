export class CalendarUnavailableError extends Error {
  readonly code = 'CALENDAR_UNAVAILABLE';

  constructor() {
    super('この端末またはビルドでは端末カレンダーを利用できません。');
    this.name = 'CalendarUnavailableError';
  }
}

export function getCalendarErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : null;

  if (code === 'INVALID_TIME_ZONE') {
    return 'プロフィールのタイムゾーン設定が正しくありません。Settingsで修正してください。';
  }

  if (code === 'CALENDAR_UNAVAILABLE') {
    return 'このビルドでは端末カレンダーを利用できません。development buildで開いてください。';
  }

  return 'カレンダーを読み込めませんでした。通信状況と端末の設定を確認して再度お試しください。';
}
