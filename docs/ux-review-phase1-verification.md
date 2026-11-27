# UI/UX改善 Phase 1 実装・検証記録

2026年11月27日。基点 `main` の `0b3dd44`、作業ブランチ `feat/ux-review-phase1`。

作業時の `docs/APP_IMPLEMENTATION_REFERENCE.md` 8.3にある R-01・R-02・R-11・R-03を対象とした。作業前から同文書に未コミット変更があり、レビュー資料なども未追跡だったため、それらは変更せずコミット対象から除外した。

## 実装と設計判断

- **R-01**: `AppScreen.header` を `ScrollView` の兄弟として追加。セーフエリア内でヘッダーを固定し、既存のキーボード回避・固定フッター・スクロール参照を維持した。日常画面に加え、共通部品を使うWeb/V1画面と高度な時間割も移行した。
- **R-02**: 候補の `taskId` で最新の親タスクを取得し、Tasksの公開APIから既存 `TaskFormModal` を再利用。小さな行動のIDを誤って更新しない。保存成功時は古い読込結果を無効化し、返却されたタスクを即時反映して推薦データを再取得する。失敗時はフォームと入力を保持する。候補詳細からAI相談へ親タスクID・タイトル・対象日・編集intentを引き継ぐ。
- **iOSのモーダル遷移**: Simulatorで詳細→編集の白いシートを発見したため、詳細シート内でタスクを先に取得し、iOSの実際の `onDismiss` 後にフォームや次の画面を開く方式に調整した。固定時間の待機は使わない。読込中に閉じた場合は遅れて返った結果を無視する。
- **R-11**: Native/Webの `ModalFrame` と関連操作に共通の破棄確認を適用。予定・小さな行動のフォームにもdirty判定を追加した。保存は明示操作のみで、未変更なら確認せず閉じ、未保存なら編集継続／破棄を選ぶ。保存中は閉じる・重複保存を防ぐ。Nativeの `pageSheet` をdirtyにかかわらず固定し、保護を迂回するスワイプ閉じは既存どおり無効とした。
- **表記**: 優先度の用語、日本語の日付表示を揃え、対象日のピッカーでは日付を消せないようにした。任意の期限欄は「期限なし」を維持。予定なしの二重文言を削除した。保存する日付・時刻の形式は変えていない。
- **R-03**: 日常のタスク一覧は未完了を初期表示にした。当日の実施済み繰り返しタスクも除外し、翌日は再び表示する既存の日付単位の状態を維持。「目標」「完了済み」はシェブロン付きの画面遷移ボタン、絞り込みは選択状態を持つチップとして区別した。完了済みシートの復元・一括削除は既存実装を再利用し、「すべて」からの閲覧も維持した。選択中のフィルターは件数が0になっても消さない。

参照文書8.4にある「予定の時刻編集」は8.3でPhase 2のR-04とされているため対象外とした。古い `docs/reviews` のPhase定義より、今回指定された参照文書のロードマップを優先した。依存追加、DB・認証・AI・カレンダーの契約変更はない。

## 変更ファイル

共通UI・表記・確認処理:

- `src/shared/components/AppScreen.tsx`
- `src/shared/components/ModalFrame.tsx`
- `src/shared/components/ModalFrame.web.tsx`
- `src/shared/components/DeadlineField.tsx`
- `src/shared/components/DeadlineCalendar.tsx`
- `src/shared/dateInput.ts`
- `src/shared/feedback/confirmDiscardChanges.ts`

機能・ルーティング:

- `src/features/recommendations/TodayRecommendationsScreen.tsx`
- `src/features/recommendations/ActionStepsScreen.tsx`
- `src/features/recommendations/recommend.ts`
- `src/features/tasks/index.ts`
- `src/features/tasks/TasksScreen.tsx`
- `src/features/tasks/components/TaskFormModal.tsx`
- `src/features/tasks/presentation.ts`
- `src/features/goals/GoalsScreen.tsx`
- `src/features/goals/components/GoalFormModal.tsx`
- `src/features/ai-chat/v2/ChatScreen.tsx`
- `src/features/ai-chat/v2/CalendarShareEditor.tsx`
- `src/features/settings/SettingsScreen.tsx`
- `src/features/calendar/CalendarScreen.tsx`
- `src/features/calendar/DayAgenda.tsx`
- `src/features/planner/v2/DailyPlanningScreen.tsx`
- `src/features/planner/v2/EventEditor.tsx`
- `src/features/planner/PlannerPreviewScreen.tsx`
- `src/features/today/TodayScreen.tsx`
- `src/navigation/routes/V25DailyRoutes.tsx`

回帰テスト:

- `src/__tests__/phase1-shared-ui.test.tsx`（追加）
- `src/__tests__/phase1-editors.test.tsx`（追加）
- `src/__tests__/recommendation-today.test.tsx`
- `src/__tests__/tasks-screen.test.tsx`
- `src/__tests__/ui-ux-improvements.test.tsx`
- `src/__tests__/v2-routes.test.tsx`

## 自動検証

| 検証                                                | 最終結果                                     |
| --------------------------------------------------- | -------------------------------------------- |
| `npm run typecheck`                                 | 成功                                         |
| `EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1 npm run lint` | 成功、エラー・警告なし                       |
| `npm run test:ci`                                   | 82スイート・799件すべて成功（5.821秒）       |
| `npm run export:pages`                              | 成功、公開用の環境変数注入なし               |
| `npm run verify:pages`                              | 成功、ルート・アセット・外部連携の分離を確認 |
| Git追跡対象／今回の追加ファイルのPrettier           | 成功                                         |
| `git diff --check`                                  | 成功                                         |

追加16テストで、ヘッダー／フッターのスクロール分離、キーボードイベント、Nativeモーダル形式の安定、システム閉じる／アクセシビリティ操作、日付の確定・キャンセル、親ID取得、期限のタイムゾーン変換・元の時刻維持、編集保存と失敗時保持、重複保存防止、破棄・編集継続、閉じた後の読込結果無視、未完了初期表示・フィルター・AI遷移パラメーターを検証した。既存の完了表示・日付表記に関するテストも新要件に更新した。

`npm run format:check` は作業前からある未追跡ファイル `AI_Life_Planner_V2_6_AI_Calendar_Integration_Spec.md` と `docs/analysis/CURRENT_IMPLEMENTATION_REVIEW.md` の整形だけで失敗する。これらはコミットに含めず変更もしない。全追跡対象の `prettier --check --ignore-unknown` と追加ファイルの個別チェックは成功した。

既存テストでは意図的なエラーケースのRepository警告、Node 26のlocalStorage実験的警告が出る。Nativeビルドは既存Podsの警告／毎回実行されるビルドスクリプトの注意を伴うが成功した。

## iOS Simulator

iPhone 17e / iOS 27.2、起動済みの `AI Life Planner V2 QA` を使用。`npm run ios:qa` で今回のソースをReleaseビルドし、QA用アプリIDにインストール・起動した。モーダル競合の修正後にも再ビルドして編集操作を再確認した。設定ヘッダーなど該当コードが変わっていない操作は、今回の先行ビルドの成功結果を再利用した。旧レビュー時のビルド画像は検証結果に使用していない。

| 操作                                       | 結果                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| 今日を最下部までスクロール、設定へ移動     | 固定タイトル・設定から遷移可能                                                |
| 設定を展開してログアウト位置までスクロール | 固定した閉じるから元画面へ戻れる                                              |
| 今日の候補詳細→タスク編集                  | 白いシートが解消し、同じタスクのフォームが表示される                          |
| 所要時間を5→12分、期限なし→今日、保存      | 候補が期限の近いタスクへ移り、再度の詳細で12分・日本語の期限を確認            |
| キーボード表示中に閉じる→編集継続          | 確認が表示され、入力値を保持                                                  |
| タスク名を変更→破棄                        | 元の名前と保存済み12分を保持。DB側でも照合                                    |
| タスク完了→完了済み→未完了へ戻す           | 初期一覧から消え、シートで見つかり、復元後は再び表示                          |
| 未完了・期限切れ・すべての切替             | 選択状態と一覧が変化する                                                      |
| 小さな行動の追加途中→破棄                  | 共通確認が表示され、未保存行動は作成されない。固定戻るも動作                  |
| 予定追加を未変更で閉じる／変更後に破棄     | 未変更時は確認なし、変更時は確認して破棄。予定は作成されない                  |
| 候補から対象タスクをAIに相談               | 対象名と相談文が引き継がれる。送信は実行しない                                |
| 30メッセージの長文会話                     | 自動最下部表示と本文スワイプ中に固定ヘッダーが残り、会話一覧へ1タップで戻れる |
| AI参照情報の対象日ピッカー                 | 「日付を決定」「キャンセル」のみで、「期限なし」は表示されない                |

[長文会話と固定ヘッダーの確認画像](screenshots/ui-ux-phase1-long-chat.png)

一部の標準スクロール自動操作はSimulatorのAX経路では移動しなかったため、XCTest・本文の座標スワイプ・スクリーンショットで補完した。最初の会話表示では末尾30番の検証メッセージ、本文スワイプ後には28・29番を確認した。

書込先はガードされた共通ローカルQAのみ。一時タスク1件、会話1件と30メッセージを作成して検証後にID・QA所有者・タイトルを限定して削除した。既存データ、本番Supabase、実OpenAI APIは変更・実行していない。

## 残る確認と範囲外

iPhone実機、別サイズのSimulator、Androidの視覚確認、Webブラウザーの手動操作、端末カレンダー権限許可後の実データ表示、AIの実応答は今回未検証。Webは出力・分離検査、既存認証／カレンダー／Plannerと高度な時間割の操作ロジックは全Jest回帰テストで確認した。完了済みの一括削除も既存回帰テストで確認し、Simulatorでは復元までを確認した。

Phase 2・3（予定の編集、検索・並び替え、AIスレッド管理、設定保存の一本化など）は実装していない。最終差分を再レビューし、Phase 1内に未修正の問題は見つからなかった。PRの作成へ進める状態だが、マージ前にはGitHub CIと上記未検証プラットフォームの必要な手動確認を行う。
