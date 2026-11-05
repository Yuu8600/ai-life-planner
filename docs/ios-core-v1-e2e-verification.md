# Core v1 iOS Simulator E2E確認

実施日: 2026-11-05（Asia/Tokyo）。Xcode 27.2 / iPhone 18 Pro Simulator / iOS 27.2、
Expo SDK 57.0.23のdevelopment buildで実施した。Settings / Calendar / Free Timeの
前段確認は`ios-settings-calendar-verification.md`を参照。

## 方法と対象範囲

agent-device / XCTestで実際に画面を操作した。表示されない業務項目はReact DevToolsで
表示専用コンポーネント（PlannerPreview、Timeline、TaskListItem、ActivityLogSection）の
propsだけを展開して照合した。アプリの通常のrepositoryがSupabaseから取得したデータを用い、
最後にアプリを再起動して同じPlan・履歴を再取得できることも確認した。

DBを直接照合するための認証トークン抽出案は自動承認レビューで拒否されたため実行していない。
認証情報の取り出し、service-role利用、DBやRPCへのアプリ外からの直接書き込みは行っていない。
DBカタログそのものの再検証、別ユーザーのRLS境界、並列セッションでの競合試験は今回の範囲外。

## テストデータ

Goalを`iOS E2E Core`として作成後、`iOS E2E Core v1`へ編集した。優先度は高、進行中。
以下のTaskはすべてそのGoalに関連付けて画面から作成した。

| Task                | 所要時間   | 優先度 | 期限    | 用途                                                        |
| ------------------- | ---------- | ------ | ------- | ----------------------------------------------------------- |
| iOS E2E A short     | 15分       | 低     | 11月5日 | Skipと再候補化                                              |
| iOS E2E B focus     | 30分       | 高     | 11月5日 | CompleteとTask完了                                          |
| iOS E2E C flexible  | 40→45→50分 | 中     | なし    | 編集・Stale Preview・future Actionの組み直し                |
| iOS E2E D oversized | 600分      | 高     | 11月4日 | 連続枠に収まらないTask                                      |
| iOS E2E E orphan    | 10分       | 高     | なし    | 保存後Taskを削除し、TaskなしActionをComplete                |
| iOS E2E F orphan    | 10分       | 高     | なし    | 保存後Taskを削除し、scheduledのTaskなしActionを再計画で除外 |

既存Taskは変更・実行・削除せず、既存の期限超過pending Task 2件も候補に含めて照合した。
開始時点でTodayのPlanなし、Activity Log 0件を確認した。

SettingsはAsia/Tokyo・08:00–23:00・最小20分から、終了時刻だけ20:00へ一時変更した。
標準Calendarで11月5日の`iOS E2E Meeting 1`（14:00–15:00）、
`iOS E2E Meeting 2`（16:00–17:00）を作成した。
Calendarの空き時間は08:00–14:00、15:00–16:00、17:00–20:00だった。

## 結果

| 項目                | 確認結果                                                                                                                     | 問題・修正                       | 未確認事項                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| Goals / Tasks       | Goalの作成・編集、Task 6件の作成と関連付け、40→45分の編集、再起動後の再取得が成功                                            | アプリの問題なし。コード修正なし | DBカタログの直接照合は未実施                                       |
| Planner             | RuleBasedのみ使用。7件配置、600分Task 1件未配置。予定非重複・枠内配置・所要時間・期限と優先度の候補順を確認                  | アプリの問題なし                 | OpenAIは今回使用・検証していない                                   |
| Preview / Save      | validation後7件を保存。もう一度同日保存して7→7件、Action IDは全件入れ替わり、重複追加なし                                    | アプリの問題なし                 | daily_plansの行ID・カタログは直接照合していない                    |
| Today               | Asia/Tokyoの11月5日。保存したActionの時刻・タイトル・Task / Goalの対応を再取得して確認                                       | アプリの問題なし                 | 実機での画面・操作確認は未実施                                     |
| Complete / Skip     | BのAction・Taskがcompleted。AのActionはskipped、Taskはpending。Task削除済みEのActionもComplete成功                           | アプリの問題なし                 | 同時に複数端末で実行する競合試験は未実施                           |
| Activity Log        | completed 2件・skipped 1件。Action title、予定開始終了、plan date、timezone、Task / Action参照を照合                         | アプリの問題なし                 | 今回は管理者SQLでテーブルを直接読んでいない                        |
| Replanning          | Todayから手動開始。7→4件の全置換に成功。B完了Taskを除外、A pending Taskを再配置、C future Actionを変更、旧nullable E/Fを除外 | アプリの問題なし                 | DB競合ガードへの別セッション割り込み試験は未実施                   |
| Stale Preview Guard | Preview後にCを45→50分へ変更。同じPreviewの承認を拒否し、TodayはPlanなしのまま。明示的な再生成後に保存成功                    | アプリの問題なし                 | 操作中に時間も経過しており、Task変更単独の拒否要因は隔離していない |

## 時刻と配置の照合

最初のPreviewは13:12以降、最初の保存は13:16以降、同日置換は13:18以降に配置された。
同日置換後のE2E Taskは以下のとおり。固定予定14:00–15:00、16:00–17:00と重ならず、
全Taskで所要時間を満たす。既存の期限超過Taskは候補順で先に処理される。
first-fitのため、後順位の短いTaskが早い隙間に入ることと、表示が時刻順になることも確認した。

| Task            | 同日置換後の時刻 | 実行後                                |
| --------------- | ---------------- | ------------------------------------- |
| E（Task削除後） | 13:48–13:58      | Action completed、Task参照なし        |
| B               | 15:30–16:00      | Action / Task completed               |
| A               | 17:00–17:15      | Action skipped / Task pending         |
| F（Task削除後） | 17:15–17:25      | Action scheduled、Task参照なし        |
| C               | 17:25–18:15      | 50分、Action scheduled / Task pending |

Replanningは13:22以降で再構築した。Aは15:30–15:45、Cは17:00–17:50へ移動した。
残る2件は既存pending Taskで、新Planは合計4件。旧Action IDは全件消え、新しいIDに変わった。
再起動後も同じ4件の保存結果が読み込まれた。

Activity Log 3件は再計画の前後・再起動後で全フィールドが一致した。
`plannedActionId`は削除された旧Actionの当時のUUIDを保持するsnapshotであり、null化されない。
これはmigrationの定義と一致する。Eの`taskId`は実行前にTask削除済みなのでnull、A/Bは元のTask ID。
置換による追加履歴や履歴の書き換えは発生しなかった。

## 開発環境で発生したこと

再起動時に元のMetroが停止しており、development clientから接続できなかった。
さらにlocalhost指定ではIPv6の`::1`だけで待ち受け、127.0.0.1では接続できなかった。
`npm run start:dev -- --host lan --port 8081`で復旧し、既存のLANアドレスで再接続した。
アプリコード、native設定、依存パッケージの変更は不要だった。

## 終了状態と判定

検証用Goal、A/B/C/DのTask、再計画後のPlan 4 Action、Activity Log 3件を確認用に残す。
E/FのTaskはnullable確認のため削除済み。Activity Logは削除・改変していない。
Calendarテスト予定2件は検証後に削除済み。Settingsの終了時刻も元の23:00へ復元した。

アプリコードの不具合は今回見つからず、新機能・リファクタリング・migration・依存追加は不要。
本記録以外のアプリソース変更はない。品質チェックはtypecheck、lint、format、format:check、
Jest（51 suites / 482 tests）、git diff --checkを実行し、すべて成功した。

**今回依頼されたCore v1の主要な操作フローは、iOS SimulatorでE2E確認完了と判断できる。**
この判定は実機、OpenAI、DBの直接監査、複数端末の競合、通信断や日付跨ぎ等の全異常系まで
確認済みという意味ではない。次の確認対象はiPhone実機での同フローとCalendar権限・端末予定取得。
