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
        detail: '権限と端末の予定は「予定」タブで確認できます',
        id: 'calendar',
        label: '端末カレンダー',
        value: '「予定」タブ',
      },
      {
        detail: 'ルールベースはAPI設定なしで利用できます。生成方法は「計画」タブで選択します。',
        id: 'ai-planner',
        label: '計画の生成方法',
        value: '「計画」タブ',
      },
    ],
  },
];
