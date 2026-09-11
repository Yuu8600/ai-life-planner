import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';

import { DayTimeline } from './components/DayTimeline';
import { CALENDAR_DATE, CALENDAR_ITEMS } from './data';

export function CalendarScreen() {
  return (
    <AppScreen testID="calendar-screen">
      <ScreenHeader
        eyebrow={CALENDAR_DATE}
        subtitle="固定予定とAIが組んだ行動を、一日の流れで確認します。"
        title="カレンダー"
      />
      <DayTimeline items={CALENDAR_ITEMS} />
    </AppScreen>
  );
}
