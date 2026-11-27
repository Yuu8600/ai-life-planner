# Development / local setup

API・アカウント不要で試す場合は[Web Demo](web-demo.md#ローカルで開く)を使う。
以下は自分のSupabase開発プロジェクトとNative開発環境を用意する場合の手順。

共通QA・実機ビルド・クラウド移行は[環境運用](qa-environments.md)を参照。

## 必要な環境

- Node.js `^22.13.0 || >=24`、npm。lockfileのバージョンを使うため`npm ci`を使用。
- iOS: macOS / Xcode / CocoaPods。実機は自分のApple Accountで署名する。
- Android: Android SDKとEmulatorまたは実機。今回の公開準備ではAndroid E2Eを追加実施していない。
- Calendar APIはExpo Go非対応。development buildを使用する。

```sh
npm ci
cp .env.example .env
```

## Supabase設定

自分で作成した開発プロジェクトのProject URLとPublishable Keyを`.env`へ設定する。
`.env.example`には変数名のみを置いている。作者のprojectへ接続する手順ではない。

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

`EXPO_PUBLIC_`はclientへ埋め込まれる公開値。Secret Key、`service_role` key、OpenAI API key、
database passwordを設定しない。未設定・不正なURLはAuth画面で設定エラーとなる。

自分の開発環境でCLIにログインし、**対象projectを確認してから**schemaを適用する。
以下はremote DBへ変更を行う管理操作で、Web Demoを試すためには不要。

```sh
npx supabase login
npx supabase link --project-ref <自分の開発project-ref>
npx supabase db push --dry-run
npm run supabase:db:push
npm run supabase:types:linked
```

database passwordやPersonal Access Tokenをコマンド引数・ファイル・ログへ残さず、CLIの安全な入力手順を使う。
Dockerを使うローカルSupabase環境は任意。`db reset`等の初期化操作はデータを破棄するため、対象を確認する。

## Auth / 起動

NativeはEmail + PasswordでSignup / Loginし、SQLiteに保存したsessionを復元する。
Supabase側のConfirm emailが有効なら、確認メールの操作後に手動でアプリへ戻ってLoginする。
確認メールのdeep link、password reset、OAuthは現在の実装範囲外。

```sh
npm run ios
# Androidの場合
npm run android:dev
```

2回目以降、native依存やapp configを変更していなければ、インストール済みdevelopment buildを使える。

```sh
npm run start:dev
```

iPhoneでLAN接続する場合の確認記録は[iPhone verification](ios-device-core-v1-verification.md)。
Personal TeamのSigningは各自のローカル環境へ設定し、Team ID・UDID・profileをcommitしない。
Personal Team署名のRelease buildで、Metro停止・USB解除後のiPhone単体利用も確認済み。
共通QAのSimulatorは `npm run ios:qa`、クラウドの実機は `npm run ios:cloud`（`ios:release` も同じガードを使用）。署名期限後の更新、データ保持、検証範囲は
[Personal Team Release](ios-personal-release.md)を参照。

## Calendar / planning settings

Settingsはtimezone、活動開始・終了、最小空き時間、Calendar予定前後の共通余白を編集する。
余白の計算仕様とDB反映・更新順序は[Calendar予定前後の余白](calendar-buffers.md)を参照。
Calendarの権限はアプリ内の許可操作で要求し、通常予定・終日予定を読み取り専用で正規化する。
端末予定をSupabaseへ複製せず、予定の追加・変更・削除も行わない。

AndroidではCalendar package / pluginがREADとWRITEの両権限を宣言するが、アプリの処理は読み取りのみ。
iOSのフルアクセス拒否・再許可、終日予定のdate-only境界、timezoneについては[検証記録](ios-settings-calendar-verification.md)を参照。

## 旧PlannerのOpenAI設定

標準ProviderはRuleBasedで、OpenAI未設定でもCoreは動く。Web DemoにはOpenAI経路を含めない。
Nativeの任意Providerは`Supabase Edge Function → OpenAI Responses API`を通り、共通Validatorで検証する。

旧 `planner-generate` を利用する場合は自分のSupabase Edge Function Secretとして`OPENAI_API_KEY`と`OPENAI_MODEL`を設定する。
clientの.envやGitへ実キーを置かない。Functionの稼働とavailabilityを確認してから明示選択する。
model対応・料金は利用時の公式資料で確認する。今回の公開準備ではSecret設定・remote deploy・実API呼び出しを行っていない。
Todayの「AI相談」が使う `v2-chat` の設定は[環境運用](qa-environments.md#ai設定)を参照。

## Schema / types / verification

正本は`supabase/migrations`。schema変更はmigrationへ記録し、生成型を更新してからtypecheckする。
`src/services/supabase/database.types.ts`を手書きで置き換えない。

```sh
npm run supabase:migration:new -- change_name
npm run supabase:types:linked
# ローカルSupabaseを使う場合
npm run supabase:types:local
```

linked projectのtransactional検証SQLとfixtureは`supabase/tests/remote`にある。
開発者が対象・影響を確認して実行する管理用検証であり、CIやWeb Demoの起動時には実行しない。
履歴の検証SQLや`create_today_planned_action.sql`をproductionへ無条件に実行しない。
認証namespace、RLS、atomic保存、実行、履歴、再計画の検証範囲は[docs index](README.md#verification)へ。

## 品質チェック / CI

チェックは次の3段階で選ぶ。既存CIの品質ゲートは維持する。

| 段階                   | 実施するチェック                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A. 開発途中            | 関連Jest、変更に必要なlint・format確認。型やinterface変更時は全体typecheck。小さな変更のたびに全Jestを実行しない |
| B. 実装完了時          | 全体typecheck・lint、変更ファイルのformat確認、関連Jest、`git diff --check`                                      |
| C. PR作成前・Release前 | 全Jest、全体typecheck・lint・format確認、`git diff --check`。変更に応じて下記の追加確認                          |

Bでも、次の変更は全Jestを実行する。

- Planner共通ロジック・Contracts・Validator。
- Calendar・Free Time・timezone。
- Persistence・Replanning・stale guard。
- 共通UI・複数画面に影響する変更。
- 依存関係・設定、または影響範囲が不明な変更。

文書のみの変更では、変更ファイルのformat確認、差分・文書整合性の確認、`git diff --check`を行う。
Cでは文書変更でも全体チェックを満たす。文書変更だけを理由にE2E・iOS build・Web exportは実行しない。

関連Jestの実行例（`<変更ファイル>`・`<テストファイル>`は実際のパスへ置き換える）:

```bash
npm run test:ci -- --findRelatedTests <変更ファイル>
npm run test:ci -- --runTestsByPath <テストファイル>
npm run test:ci -- --changedSince=origin/main
```

`--findRelatedTests`は依存関係から対象を選び、`--runTestsByPath`はテストファイルを明示する。
`--changedSince`は指定branchとの差分に関連するテストを選ぶ。`origin/main`の状態と選択対象を確認する。
自動選択だけで実機・DB・Web出力まで検証できるわけではない。0件なら成功扱いせず、対象を見直す。

変更ファイルのformat確認例:

```sh
npx prettier --check AGENTS.md docs/development.md
```

Cの全体チェック:

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test:ci
git diff --check
```

`npm run format`は自動整形であり、確認には`format:check`を使う。`npm test`は全テストのwatch mode。
PR / mainのCIはtypecheck・lint・format・Jestだけを実行し、DB・OpenAIへ接続しない。
Pages workflowは手動実行で、品質チェックに加えてexportとartifactの検査を行う。
GitHubでのpush・PR・マージは、以下の[Git運用](#git--github運用)に従ってCodexが担当する。

### 再実行とログ

成功したコマンド・対象範囲・コード状態が明確で、その後に影響する変更がなければ、段階が変わっても
同じチェックを不必要に再実行しない。関連ソース・テスト・設定・依存関係を変更したら影響するチェックを再実行する。
結果や対象コード状態が不明なら必要な検証を行い、未実行のチェックを成功済みとして報告しない。

成功時はコマンド・成否・テスト件数・必要に応じた所要時間を簡潔に報告する。
大量のPASS一覧や不要なbuildログを最終報告へ貼り付けない。
失敗時は原因調査に必要な詳細を保持・確認し、警告や失敗を隠さず、終了コードを正しく判定する。

### 変更に応じた追加確認

| 確認                                            | 実施する変更・タイミング                                                                                                                                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run export:pages` → `npm run verify:pages` | Web Demo、Webにも影響する共通UI・業務ロジック、navigation、Web配信設定・依存の変更時とPages公開前。検査は今回生成した出力に対して実行                                                                                               |
| `npx expo-doctor`                               | Expo / Native依存・app config変更時とRelease前                                                                                                                                                                                      |
| iOS build                                       | Native依存・plugin・app config変更時とiOS Release時。JSのみの開発では既存development buildを活用                                                                                                                                    |
| 実機確認 / 必要なE2E                            | Native画面・操作変更時は関連フロー、特にkeyboard・Safe Area・権限・Calendarを確認。Calendar変更では終日予定・timezone、Planner / Today変更では保存・Complete / Skip・再計画・履歴を確認。Release前は起動・session・主要フローを確認 |

実機・E2Eは端末やデータへの影響を考慮して実施し、未確認の範囲は報告する。
iPhone Releaseのbuild・上書きinstallは[Personal Team Release](ios-personal-release.md)を参照。

Expo/native dependencyを追加する場合は`npx expo install`でSDK互換性を確認する。
package.jsonのpeer overridesはSDK 57互換範囲を保つための固定値で、更新時にlockfileと共に確認する。

## Git / GitHub運用

2026年11月27日以降、通常の開発ではCodexがGit・GitHub操作を一貫して担当する。
push・PR作成・マージのたびに利用者へ個別の許可を求めない。過去の仕様書・QA手順にある
「利用者がpush・PR・マージする」という分担は、この方針で置き換える。リリース・本番反映の承認とは分ける。

1. `git status`、worktree、未コミット・未追跡・未pushの変更を確認する。利用者の既存変更は保持し、今回のcommitへ混在させない。
2. リモートをfetchし、ローカルmainをfast-forwardで最新化する。上書きや履歴の分岐がある場合はresetせず、別checkoutで隔離するか競合を報告する。
3. 既存の命名規則に従い `feat/`・`fix/`・`docs/` の作業branchを作成する。
4. 依頼された範囲だけを実装し、品質チェック、差分のセルフレビュー、秘密情報・意図しないデータ変更の確認を行う。
5. Conventional Commits形式で意味のある単位にcommitし、作業branchをpushしてmain向けPRを作成する。
6. 現在のPR headに対するCI結果、PR差分、レビュー、ブランチ保護・rulesetを確認する。CIが失敗したら原因を調べ、今回の変更に必要な修正と再検証を行う。
7. 次のマージ条件をすべて満たす場合だけマージする。直前にもhead・差分・レビュー状況を照合し、対応APIがあれば確認済みhead SHAを指定する。
8. マージ後にローカルmainをfast-forward更新し、取り込み結果を確認する。取り込み済みで他のworktreeが使用していないローカル作業branchだけを整理する。
9. PR URL・マージ結果・検証結果・現在のbranch・保持した既存変更・未解決事項を報告する。

マージ条件:

- 依頼された実装範囲が完了している。
- 必要なテスト・型チェック・Lintが成功している。
- 設定された必須CIが現在のPR headで成功している。
- 必須レビュー・ブランチ保護ルール・rulesetを満たしている。
- 無関係な差分、重大な未解決問題、意図しないデータ変更、秘密情報の混入がない。

条件を満たせない、または確認できない場合はマージせず、理由を報告する。
mainへの直接push、force push、既存変更の破棄、無関係なファイルの変更、秘密情報のcommit、
必須CI・レビュー・ブランチ保護の回避（admin権限での迂回を含む）、依頼のない破壊的DB操作は禁止する。

リリース公開・本番DB変更・破壊的操作など通常のPRマージを超える作業は別途承認を得る。
既存のremote branch削除・DB migration適用・Web公開・端末更新の明示承認ルールも維持する。
マージ済みbranchの整理であっても、未pushコミットや他のworktreeの作業を削除しない。

翌日終了・計画日・DB互換性・更新手順は[翌日深夜までの活動時間](overnight-planning.md)を参照。

時間設定UIとGitHub運用は[時間入力UI](time-input-ui.md)を参照。

Todayの時間軸・空き時間の意味・確認手順は[Todayの時間軸](today-time-axis.md)を参照。

Clearのデザイントークン・共通UI・移行範囲は[Clearデザインシステム](clear-design-system.md)を参照。

Tasks・Goalsの一覧と操作の方針は[Tasks・Goals Clear UI](clear-tasks-goals.md)を参照。

Settings・Authの構成と保存操作、確認範囲は[Settings・Auth Clear UI](clear-settings-auth.md)を参照。

Calendar・Plannerの表示と承認UIは[Calendar・Planner Clear UI](clear-calendar-planner.md)を参照。

下部タブ、PCサイドバー、Settingsの離脱確認と文字拡大の制約は[ナビゲーションとPCレイアウト](clear-navigation-layout.md)を参照。
