# Portfolio screenshots

このフォルダの画像はすべて**Web Demoの実画面**。Native版の画面であるようなラベルは付けない。
撮影日: 2026-11-06（Asia/Tokyo）。Chrome、production `dist`のローカル配信を使用。
ブラウザのツールバーを含めず、ページ自体をキャプチャした。画像内容の合成・加工はしていない。

## 用意済み

| ファイル                                                 | 状態・用途                                                                  | viewport |
| -------------------------------------------------------- | --------------------------------------------------------------------------- | -------- |
| [web-today.png](web-today.png)                           | 4 Task保存後。全件scheduled、次のActionと完了・Skip操作が分かる。README掲載 | 430×1280 |
| [web-planner-preview.png](web-planner-preview.png)       | RuleBasedで4件配置、保存前、配置時刻とCalendar非重複が分かる。README掲載    | 430×1280 |
| [web-calendar-free-time.png](web-calendar-free-time.png) | サンプル予定3件と空き時間4枠・合計660分。README掲載                         | 430×1280 |
| [web-tasks.png](web-tasks.png)                           | 同じ4 Task、優先度・期限・所要時間。追加の紹介用                            | 430×1000 |
| [web-goals.png](web-goals.png)                           | TOEICのGoalと進捗。追加の紹介用                                             | 430×1000 |
| [web-demo.png](web-demo.png)                             | Desktopの入口と体験説明。ポートフォリオのリンク用                           | 1280×900 |

READMEには主要3枚だけを横並びで載せる。追加画像はここから参照できる。
撮影用の長いviewportは情報を読みやすく収めるためのもの。特定iPhoneの実解像度を表すものではない。
375 / 390px等の通常viewportでの表示検証は[Web Demo記録](../web-demo.md#verification)を参照。

## 共通データ

- Goal: **TOEIC 730点を達成する**、現在600点、目標730点、期限2026-12-06。
- Tasks: 英単語30分（高・サンプル当日期限）、Part 5演習30分（高・翌日期限）、リスニング45分（中）、模試復習60分（低）。
- Calendar: 大学09:00–10:30、授業13:00–14:30、サークルの予定18:00–19:00。
- Settings: Asia/Tokyo、08:00–23:00、最小20分。
- サンプル時計: 2026-11-06 08:00 JST。実際の現在時刻ではない。
- 保存後の配置: 08:00–08:30、08:30–09:00、10:30–11:15、11:15–12:15。

Web画像に実名・メール・Supabase情報・APIキー・端末の個人予定はない。
README掲載前に全画像を目視確認した。撮影で利用した一時Chrome profileとダミーデータは本番データから分離している。

## Webの再撮影

1. `npm run export:pages`、`npm run verify:pages`、`npm run preview:pages`を実行する。
2. ローカルのDemoを新しいブラウザprofileまたはprivate windowで開く。ログインは不要。
3. 「デモをリセット」で08:00へ戻し、Goal / Tasksが上記のデータになっていることを確認する。
4. Calendarを撮影。Plannerを生成し、**保存前**のPreviewを撮影する。
5. 保存してTodayへ移り、完了・Skipする前の状態を撮影する。
6. 同じviewportと拡大率100%を使い、個人profileのブラウザtoolbar・通知を含めない。
7. ファイル名はこのフォルダのものを使用し、個人情報がないことを目視で確認する。

## Native画面を追加する場合（ユーザー操作）

追加撮影は今回の公開に必須ではない。掲載するなら以下の状態を揃え、`native-` prefixでWebと区別する。

1. 実機の個人Calendar・個人アカウントをそのまま撮らず、Simulatorまたは分離した撮影用のCalendar / テストユーザーを使う。
2. 端末Calendarに上記3件のダミー予定だけが見える状態を作る。公開用に用意した自分の開発データだけを操作する。
3. Goal / Tasksは上記に揃え、Settingsを東京08:00–23:00、最小20分へ設定する。
4. Native Plannerは**実際の現在時刻以降**へ配置する。午前の活動開始前に撮るか、その日の未来の時間帯で予定・Taskを揃える。
   Webの固定時計をNativeにも実装済みであるように扱わず、日付・配置が違う場合はcaptionに明記する。
5. 優先画面はToday（保存後・未実行）、Planner Preview（保存前）、Calendar + Free Timeの3つ。
6. Expo開発用の浮動ボタン、通知、個人のメール・予定・接続先・エラー詳細が画面にないことを確認して撮影する。
7. 生の画像をこのフォルダへ直接追加する前に内容を確認し、公開用だけを採用する。撮影後は一時データ・設定を元へ戻す。

NativeのLogin / Settingsのアカウント欄、認証エラー、開発者メニュー、端末のCalendar一覧は公開画像に使わない。
assets内のアプリアイコンはExpo starter由来であり、独自デザインとして紹介しない。
