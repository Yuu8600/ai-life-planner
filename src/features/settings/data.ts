export type SettingItem = {
  detail?: string;
  id: string;
  label: string;
  value: string;
};

export type SettingSection = {
  id: string;
  items: SettingItem[];
  title: string;
};

export const SETTING_SECTIONS: SettingSection[] = [
  {
    id: 'connections',
    title: '計画との連携',
    items: [
      {
        detail: '権限と端末の予定はCalendarタブで確認できます',
        id: 'calendar',
        label: '端末カレンダー',
        value: 'Calendarタブ',
      },
      {
        detail: 'ルールベースはAPI設定なしで利用できます。生成方法はPlannerタブで選択します。',
        id: 'ai-planner',
        label: '計画の生成方法',
        value: 'Plannerタブ',
      },
    ],
  },
];
