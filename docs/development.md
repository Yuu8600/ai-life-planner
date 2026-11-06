# Development / local setup

API・アカウント不要で試す場合は[Web Demo](web-demo.md#ローカルで開く)を使う。
以下は自分のSupabase開発プロジェクトとNative開発環境を用意する場合の手順。

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
再build・上書きinstallは`npm run ios:release`。署名期限後の更新、データ保持、検証範囲は
[Personal Team Release](ios-personal-release.md)を参照。

## Calendar / planning settings

Settingsはtimezone、活動開始・終了、最小空き時間を編集する。
Calendarの権限はアプリ内の許可操作で要求し、通常予定・終日予定を読み取り専用で正規化する。
端末予定をSupabaseへ複製せず、予定の追加・変更・削除も行わない。

AndroidではCalendar package / pluginがREADとWRITEの両権限を宣言するが、アプリの処理は読み取りのみ。
iOSのフルアクセス拒否・再許可、終日予定のdate-only境界、timezoneについては[検証記録](ios-settings-calendar-verification.md)を参照。

## Optional OpenAI

標準ProviderはRuleBasedで、OpenAI未設定でもCoreは動く。Web DemoにはOpenAI経路を含めない。
Nativeの任意Providerは`Supabase Edge Function → OpenAI Responses API`を通り、共通Validatorで検証する。

利用する場合は自分のSupabase Edge Function Secretとして`OPENAI_API_KEY`と`OPENAI_MODEL`を設定する。
clientの.envやGitへ実キーを置かない。Functionの稼働とavailabilityを確認してから明示選択する。
model対応・料金は利用時の公式資料で確認する。今回の公開準備ではSecret設定・remote deploy・実API呼び出しを行っていない。
Provider失敗時に自動で別Providerへ切り替える構成ではない。

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

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test:ci
git diff --check
npm run export:pages
npm run verify:pages
```

`npm run format`は自動整形、`npm test`はwatch mode。
PR / mainのCIはtypecheck・lint・format・Jestだけを実行し、DB・OpenAIへ接続しない。
Pages workflowは手動実行で、品質チェックに加えてexportとartifactの検査を行う。
実際のGitHub上でのCI / Pages実行はユーザーがpushした後の確認項目。

Expo/native dependencyを追加する場合は`npx expo install`でSDK互換性を確認する。
package.jsonのpeer overridesはSDK 57互換範囲を保つための固定値で、更新時にlockfileと共に確認する。
