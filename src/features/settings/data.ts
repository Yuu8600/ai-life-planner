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
        label: 'Calendar設定',
        value: 'Calendarタブ',
      },
      {
        detail: '提案の方針や自動調整は今後設定できます',
        id: 'ai-planner',
        label: 'AI Planner設定',
        value: '標準',
      },
    ],
  },
];
