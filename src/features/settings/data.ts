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
    id: 'daily-rhythm',
    title: '一日の基本設定',
    items: [
      { id: 'start-time', label: '活動開始時間', value: '08:00' },
      { id: 'end-time', label: '活動終了時間', value: '22:00' },
      { id: 'minimum-slot', label: '最小空き時間', value: '20分' },
    ],
  },
  {
    id: 'connections',
    title: '計画との連携',
    items: [
      {
        detail: '端末カレンダーとの接続は今後設定できます',
        id: 'calendar',
        label: 'Calendar設定',
        value: '未接続',
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
