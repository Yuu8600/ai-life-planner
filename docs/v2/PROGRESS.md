# AI Life Planner V2 進捗

2026-11-14（日本時間）。利用者の出力で `v1-stable` と `v1.0.0` のGitHub保存を確認済み。`feat/v2-redesign` でV2の主要機能を実装した。実ファイル名 `AI_Life_Planner_V2_Handoff.md` のローカル引き継ぎ文書を通読した。

## V1の保全

- ローカルの `v1-stable` と注釈付きタグ `v1.0.0` は、どちらもコミット `45cee67db8f8b8c08f09c3f85ab66048fd2f209a` を指す。GitHubの `main` も確認時点では同じSHA。ローカルの未pushコミットは0件。GitHubに同名ブランチ・タグ・V2予定ブランチはなかった。
- 追跡済みファイルへの未コミット変更はなかった。元から未追跡の引き継ぎ文書と `docs/ios-step-10-verification.md` は保持した。後者はStep 10の一部確認と残項目の記録。今回はV1の実機再検証をしていない。
- Node 26.13.0、npm 11.20.0。プロジェクトの指定はExpo SDK 57、React Native 0.86.3、React 19.2.3、TypeScript 6.0系、Supabase JS 2.116系。既存の `node_modules` を使った。
- `npm run typecheck` とiOS向けのExpo exportに成功した。Authルーティング、Today取得、空き時間、ルールベース配置、承認と再計画、作業枠実行の既存Jest 7スイート・107件が成功。CoreSimulatorServiceに接続できず、シミュレータ起動は未実施。実機操作、ローカル・本番DB、実OpenAI APIは未検証。詳細コマンドは [TEST_REPORT.md](TEST_REPORT.md)。
- GitHub保存手順は [DEPLOY_AND_RELEASE.md](DEPLOY_AND_RELEASE.md)。V1のGit参照には過去の個人メールを含む履歴がある。対象コミットは確認時点の公開 `main` から取得可能で、今回のタグの作成者メールはGitHubのnoreply形式。

## 着手前に確認したV1とV2の差分

| 領域               | V1の入口・現状                                                                                                                                                                                          | V2で扱う差分                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 認証・Goals・Tasks | `src/features/auth` と `src/services/supabase/repositories`。ユーザー単位のCRUD。Goal期限とTaskのGoal紐付けは任意。Taskの期限は既存DBの時刻から設定TZの日付に変換する。                                 | 既存Authとフォームを再利用。Taskのローカル日付・単発・曜日指定・週N回、週の実行日数、枠とTaskの状態管理、期限切れへの明示操作を設計する。 |
| カレンダー・設定   | `ExpoCalendarRepository`、`loadCalendarPlanningEvents`、`calculateFreeTime`。読み取り専用の端末予定、終日／空き状態、個別／全体の前後バッファ、日跨ぎ、設定TZ。V1の生成は端末カレンダー許可を要求する。 | 許可なし・取得失敗の明示、限定モードの承認、アプリ内固定・柔軟予定と移動時間、Task間余裕の設定を追加する。                                |
| Planner            | `contracts.ts`、`selectPlannerTasks.ts`、`schedulePlannerTasks.ts`、`plannerValidator.ts`。V1はGreedyで基本1枠／Task。Validatorも重複配置を拒否する。空きの現在時刻クリップあり。                       | 初回と追加配置、緊急枠、期限切れ除外、実行状況による優先、自由時間と実際のTask間余裕、繰り返し、決定性と終了保証をUIと分離する。          |
| Today・再計画      | `TodayRoute`、`SupabaseTodayRepository`。保存済みPlanの時間窓で取得。作業枠完了・スキップとActivity Logあり。`PlannerRoute` の既存Previewで最新入力を再検証し、再計画はDB snapshotと照合する。          | 日を開いたときの初回生成、保存済み計画の保持、固定・ドラッグと時刻入力、未確認・あとで・今日はしない、衝突検知と最小変更をつなぐ。        |
| AI                 | Nativeの現在のAIタブは `PlannerRoute`。既存 `planner-generate` は認証付きの任意Planner生成。AIチャット用画面はfixtureで、スレッド・下書き・利用量の永続化はない。Web Demoはメモリ実装。                 | 別のEdge Functionとサーバー予算・利用量、複数ターン・文脈最小化、下書き、選択承認・stale検証・原子性・重複防止。非AI機能から独立させる。  |
| DB互換             | `supabase/migrations` と既存アダプター。V1は `profiles`、`goals`、`tasks`、`daily_plans`、`planned_actions`、`activity_logs`、`calendar_event_buffer_overrides` を使用。                                | 既存テーブル・RLS・GRANT・RPC・Edge契約を保つ。V1の全置換経路によるV2枠の消失を防ぐ設計が必要。共有DBの動作確認を経て本番運用を判断する。 |

V1の `replace_daily_plan` は同日Planの既存明細を削除して再作成する。V2は専用の日次計画テーブルに保存し、V1の関数・権限・ログのコードを保った。V2 migration適用後の一時DBでV1の日跨ぎSQL検証は成功。

## 完了と再開

| フェーズ      | 状態                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------- |
| 0 保全        | GitHubのV1ブランチ・タグ確認済み                                                                    |
| 1 Domain / DB | PlannerとAIの追加migration、生成DB型、SQL検証                                                       |
| 2 Planner     | 初回生成・候補抽出・配置・自由時間・最小再計画・stale照合                                           |
| 3 iPhone画面  | Today・カレンダー・Tasks・Settingsに接続                                                            |
| 4 AI          | 会話・予算・下書き・選択承認・Plannerへの引き渡し                                                   |
| 5 公開準備    | 重要な自動チェック、iPhone 17eシミュレータの起動、手順書を完了。実機、staging、本番は利用者確認待ち |

次は [公開手順](DEPLOY_AND_RELEASE.md) の順にV2ブランチのpushとPRを行い、テスト用Supabaseを用意して [iPhone手動テスト](MANUAL_TEST_CHECKLIST.md) を進める。未実装・制約は [実装ノート](IMPLEMENTATION_NOTES.md)、検証の範囲は [テスト報告](TEST_REPORT.md)。修正作業を再開する場合は `git status --short --branch` でブランチと利用者の未追跡ファイルを確認した上で、対象画面と関連する最小のテストだけを実行する。
