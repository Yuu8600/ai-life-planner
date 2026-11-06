# Architecture

## Core v1の流れ

Goals / Tasks・計画設定・CalendarからPlannerInputを作り、Providerの提案をValidatorへ通す。
Previewを確認後、承認時に最新状態を再検証して保存し、Todayから実行する。
手動Replanningも同じ経路を通り、保存済みPlanの競合tokenを条件に全置換する。

## コードの入口

| 場所                                  | 役割                                                               |
| ------------------------------------- | ------------------------------------------------------------------ |
| `src/app`                             | Expo Routerのroute。platform別compositionをre-export               |
| `src/navigation/routes`               | NativeのAuth / Supabase / Calendar接続と、`.web.tsx`によるDemo接続 |
| `src/navigation/DemoRoutes.tsx`       | 共通のfeature画面へDemo Repositoryを注入                           |
| `src/features`                        | feature単位の画面・hook・domain / application処理・Repository契約  |
| `src/services`                        | Supabase、端末Calendar、DemoのI/O adapter                          |
| `src/shared`                          | 共通UI、theme、navigation、platform別確認ダイアログ                |
| `supabase/migrations`                 | version管理するschema / RLS / RPC                                  |
| `supabase/functions/planner-generate` | 任意OpenAIへ接続するserver境界                                     |

画面はSupabaseやCalendar SDKを直接呼ばず、Repository interfaceを受け取る。
NativeとWebのI/OはMetroのplatform module解決で分離し、Web bundleにNative側の接続を含めない。

## 共有するPlanner

- `freeTimeCalculator.ts`: 計画可能時間へ予定をclampし、重複busy区間をmergeして、最小時間以上のfree slotsを返す純粋関数。
- `loadPlannerInput.ts`: 最新のSettings / Calendar / Goals / Tasksを取得し、今日については現在時刻より前の枠を除外。
- `RuleBasedPlannerProvider.ts`: deadline / priority / durationを使う決定的な配置。外部API不要。
- `contracts.ts` / `plannerValidator.ts`: Provider共通の入出力と、構造・日付・Task参照・枠内配置・非重複の検証。
- `plannerPersistence.ts`: 承認時に入力を再取得して再検証し、失効したPreviewの保存を拒否する。

OpenAI Providerも同じContractへ従う。返却値は信頼済みの型として扱わず、共通Validatorを通す。
所要時間との差異はValidator上のwarningであり、すべての編集で保存を拒否するわけではない。

## 保存・実行・履歴

NativeはRPC内でDaily Plan / Planned Actionをatomicに保存し、同日のPlanをreplaceする。
ownership条件とRLSにより、認証したユーザーのデータへ操作を限定する。

CompleteはActionと関連Taskを完了し、SkipはActionのみ変更する。
Activity Logは実行時点のtitle・予定時刻等をsnapshotとして保持するため、Task削除やPlan置換後も履歴を残せる。
Replanningではcompleted Taskを除外し、skipped ActionのTaskがpendingなら再候補にする。
保存済みPlan / Actionのsnapshotを承認時のDB条件とし、別操作による変更を上書きしない。

Web Demoは同じRepository契約をメモリ内で実装する。DB transactionの検証を代替するものではなく、
生成・承認・保存・実行・再計画のプロダクト体験を独立して示すもの。[詳細](web-demo.md)

## 現在の範囲

主対象は日本語のCore v1 Nativeアプリと、API不要の公開用Web Demo。
Calendarの書き込み、Todayへの端末予定の統合、OAuth、password reset、offline同期、
自動Replanning、OpenAIの実API E2Eは現在の確認範囲に含めない。
NativeのMetroなしRelease buildは次の検証対象。
