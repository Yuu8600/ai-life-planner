# 検証記録

## フェーズ0のV1基点

対象は `45cee67db8f8b8c08f09c3f85ab66048fd2f209a`。2026-11-14（日本時間）。

| コマンド                                                                                                                           | 結果                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `npm run typecheck`                                                                                                                | 成功                                                   |
| 下記の重要Jestスイート                                                                                                             | 7スイート・107件成功                                   |
| `CI=1 EXPO_OFFLINE=1 ./node_modules/.bin/expo export --platform ios --output-dir "$build_dir" --clear`（出力先は一時ディレクトリ） | 成功。iOS向けバンドルを生成                            |
| `xcrun simctl list devices booted`                                                                                                 | CoreSimulatorService接続失敗。シミュレータ起動は未実施 |

```sh
npm run test:ci -- --runTestsByPath \
  src/__tests__/auth-routing.test.tsx \
  src/__tests__/today-repository.test.ts \
  src/__tests__/free-time-calculator.test.ts \
  src/__tests__/rule-based-planner-provider.test.ts \
  src/__tests__/planner-approval.test.ts \
  src/__tests__/planner-replan-repository.test.ts \
  src/__tests__/planned-action-execution.test.ts
```

実機、RLSの実DB確認、実OpenAI API、フルE2Eは未実施。V2の検証結果は実装後に追記する。

## V2ローカル検証

| コマンド                                                                                                    | 結果                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`、`npm run lint`                                                                         | 成功                                                                                                                                                          |
| 対象Jestスイート（下記）                                                                                    | 12スイート・142件成功。Planner不変条件、認証とカレンダー、保存と再計画、AIモックによる予算拒否を確認                                                          |
| `CI=1 EXPO_OFFLINE=1 npm run export:pages`、`npm run verify:pages`                                          | 成功。Web Demoのルート、assets、外部連携の分離を確認                                                                                                          |
| `CI=1 EXPO_OFFLINE=1 npx expo run:ios --configuration Release --device <iPhone 17eのUDID> --no-bundler`     | ビルド成功（0エラー、2警告）。iOS 27.2のiPhone 17eシミュレータでログイン画面表示を確認。ログイン操作は未実施                                                  |
| 一時ローカルSupabaseで `db reset --local`、`gen types --local --schema public`                              | V1からV2までのmigrationを適用し型を生成。型生成コンテナにMaxListeners警告が出たが終了コード0                                                                  |
| `psql -v ON_ERROR_STOP=1` で `supabase/tests/local/v2_planner.sql`、`v2_chat.sql`、`overnight_planning.sql` | 3本成功。RLS、直接更新不可、stale・二重作成拒否、AI予算・並行予約、依存Goal、承認の原子性・冪等性、V1の日跨ぎ保存と、同日V1の保存後もV2の計画が残ることを確認 |

```sh
npm run test:ci -- --runTestsByPath \
  src/__tests__/auth-routing.test.tsx \
  src/__tests__/{v2-chat,v2-planner,task-repository,settings-repository}.test.ts \
  src/__tests__/{planner-approval,free-time-calculator,today-repository}.test.ts \
  src/__tests__/{planned-action-execution,planner-replan-repository,task-validation,calendar-repository}.test.ts
```

新規PreviewテストでJestの動的importがVMモジュールを要求したため静的importに変更した。実機操作、共有本番、実OpenAI API、フルE2Eは未実施。操作テストは [MANUAL_TEST_CHECKLIST.md](MANUAL_TEST_CHECKLIST.md) を参照。
