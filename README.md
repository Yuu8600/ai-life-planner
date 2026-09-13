# AI Life Planner

目標・Todo・端末カレンダー・実行実績をもとに、AIがその日の行動計画を提案・再計画する
日本語対応モバイルアプリです。

要件定義は [requirements-v0.1.md](docs/requirements/requirements-v0.1.md) を参照してください。

現在は **Milestone 2B-2 (Goals CRUD)** です。Email + Password認証済みユーザーごとに、Goalsの
作成・取得・更新・削除をSupabaseへ接続しています。Tasks、Today、Calendar、AI画面は引き続き
ローカルダミーデータを使用し、端末カレンダーとOpenAIとの実通信もまだ実装していません。

## 技術構成

- React Native / Expo SDK 57
- TypeScript（strict mode）
- Expo Router
- Supabase JS / Supabase CLI
- Expo SQLite（認証セッション保存）
- ESLint（Expo flat config）
- Prettier
- Jest / React Native Testing Library

将来の採用予定は`expo-calendar`とOpenAI APIです。これらのSDKは必要になるMilestoneまで
追加しません。

## セットアップ

前提としてNode.js `^22.13.0 || >=24` とnpm、および実行先に応じてExpo Goまたは
Android/iOSの開発環境が必要です。このNode.js範囲はReact Native Testing Library 14の要件に
合わせています。

```bash
npm install
npm run typecheck
npm start
```

起動後はExpo CLIの案内に従うか、次のコマンドで対象を指定します。

```bash
npm run android
npm run ios
```

`ios` のローカルシミュレーター実行にはmacOSが必要です。

## 品質チェック

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:ci
```

自動整形は `npm run format`、ローカルのwatch modeは `npm test` で実行できます。

## ディレクトリ構成

```text
docs/
└── requirements/
    └── requirements-v0.1.md # 要件定義書
src/
├── __tests__/              # 画面・機能のテスト（Routerのルート外）
├── app/                    # Expo Routerのルート。Auth guard、画面構成、ナビゲーション
├── features/
│   ├── auth/              # 認証状態、Login / Signup画面、Logout UI
│   ├── today/             # 今日の計画サマリーとタイムライン
│   ├── goals/             # Goalの状態管理、validation、CRUD UI、repository契約
│   ├── tasks/             # Task / Todo一覧
│   ├── calendar/          # 日表示の静的タイムライン
│   ├── ai-chat/           # 静的なAI相談画面
│   ├── settings/          # 計画の前提設定画面
│   └── planner/           # 後続Milestone向けの計画ドメイン
├── services/
│   └── supabase/          # client、Auth、生成DB型、Supabase repository実装
└── shared/
    ├── components/        # 機能に依存しない共通UI
    ├── config/            # アプリ共通設定
    └── types/             # 機能横断で共有する型
supabase/
├── config.toml            # Supabase CLIのローカル設定
├── migrations/            # Git管理するDB schema変更
├── tests/remote/          # linked remoteで実行するtransactional検証
└── seed.sql               # ローカル開発用seed（現在は空）
```

ルートや表示コンポーネントへビジネスロジックを直接置かず、機能固有の処理は各
`src/features/<feature>` に閉じ込めます。外部サービスへのアクセスは `src/services` を境界に
することで、UI・ドメインルール・インフラ実装を分離します。

## Supabaseを採用する理由

MVPで必要なPostgreSQL、ユーザー認証、Row Level Security、将来のEdge Functionsを一つの
境界で扱い、モバイルアプリへDB認証情報やサーバー秘密鍵を置かずにユーザー単位のデータ分離を
実現するためです。UIはSupabaseへ直接依存させず、repository interfaceと
`src/services/supabase`を通して接続します。

## 環境変数

プロジェクトルートに`.env`を作成し、Supabase Dashboardの対象プロジェクトにある
**Connect**画面からProject URLとPublishable Keyを取得して設定します。

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`.env`はGit管理対象外です。未設定・不正なURLの場合、値そのものをログへ出さず、Auth画面に
接続設定エラーを表示します。認証とGoals CRUDを利用するには、有効なSupabase設定とログインが
必要です。

`EXPO_PUBLIC_` で始まる値はアプリへ埋め込まれるため秘密情報には使えません。
`OPENAI_API_KEY` は将来もモバイルアプリではなく、信頼できるサーバーまたはSupabase Edge
Functionだけで管理します。

Supabaseの`service_role` keyはRLSを迂回できる秘密値です。モバイルアプリ、`.env`の
`EXPO_PUBLIC_`変数、リポジトリには絶対に配置しません。

## Email + Password認証

起動時にExpo SQLiteへ保存されたsessionを復元し、確認が終わるまでは専用Loading画面を表示
します。未ログインの場合はLogin / Signup画面、ログイン済みの場合は既存の5タブへ遷移します。
SettingsのLogoutはこの端末のsessionだけを終了します。

Supabase DashboardでConfirm emailが有効な場合、Signup後もLogin画面に留まり、確認メールの
案内を表示します。メール内の確認を完了してからLoginしてください。Confirm emailが無効な場合
はSignup時にsessionが作成され、そのままTodayへ移動します。

確認メールからアプリへ戻るDeep Linkは後続のAuth改善項目です。現在はメール確認後に手動で
アプリへ戻り、Loginしてください。

Signup後のprofile自動作成は、DashboardのAuthentication > UsersにあるユーザーUUIDを使って
次の読み取りで確認できます。アプリへservice role keyを追加する必要はありません。

```sql
select id, created_at
from public.profiles
where id = '<Authentication UsersのUUID>'::uuid;
```

## Supabase migration運用

DB schemaの正本は`supabase/migrations/`です。remote DashboardのTable EditorやSQL Editorで
直接schemaを変更せず、必ずmigrationを作成・レビューしてから反映します。

```bash
npm run supabase:migration:new -- add_example_column
npx supabase login
npx supabase link --project-ref <project-ref>
npm run supabase:db:push
npm run supabase:verify:linked
```

`login`にはPersonal Access Token、`link`や`db push`にはproject情報やdatabase passwordが
必要になる場合があります。秘密値はコマンドや設定ファイルへ保存せず、CLIの安全な入力手順に
従ってください。Dockerを使うローカル環境は任意です。利用する場合だけ`npx supabase start`と
`npx supabase db reset`を使用します。

## Goals CRUD

Goalsタブはログイン中ユーザーの`public.goals`だけを読み込みます。「新しい目標」から登録し、
一覧の「編集」「削除」から更新・削除できます。作成時の`user_id`はAuth sessionのユーザーIDを
repositoryが設定し、全操作をRLS policyで保護します。

タイトルは必須です。現在値・目標値は整数または小数、期限は`YYYY-MM-DD`で入力します。
優先度は高・中・低、状態は進行中・完了・アーカイブから選択します。通信失敗時はGoals画面の
「再読み込み」を使用してください。

## Database型生成

生成型は`src/services/supabase/database.types.ts`へ出力し、schema変更と一緒に更新します。
remote projectはlink済みで、core migrationを反映したschemaから現在の型ファイルを生成済み
です。schemaを変更した場合はmigration反映後に次を実行します。

```bash
npm run supabase:types:linked
```

DockerでローカルSupabaseを起動している場合は`npm run supabase:types:local`も使用できます。
生成に失敗した場合、既存の型ファイルを空にしない安全なスクリプトになっています。

linked remoteのschema、grants、RLS、所有者別CRUD、複合FKの動作は次で再検証できます。固定の
架空ユーザーとデータは一つのtransaction内だけで作成され、最後にrollbackされます。

```bash
npm run supabase:verify:linked
```

## 現在のスコープ

Milestone 0 / 0.5 / 1 / 2A / 2B-1 / 2B-2で用意したもの:

- Expo + React Native + TypeScriptの初期構成
- Expo Routerと5つのBottom Tab
- TypeScript strict mode
- ESLint / Prettier
- 機能単位のディレクトリ構成
- 環境変数テンプレートとGit除外設定
- 要件定義書のバージョン管理用配置
- Today / Tasks / Calendar / AI / Settingsの静的画面とGoals CRUD画面
- 未接続機能のローカルダミーデータと機能単位のUIコンポーネント
- Jest / React Native Testing Libraryによるタブ構成とToday画面のテスト
- Supabase clientとSQLiteベースの認証セッション永続化設定
- profiles / goals / tasksのmigration、制約、RLS policy、明示的な権限
- GoalRepository / TaskRepositoryのinterface境界
- Supabase CLIと安全なDatabase型生成導線
- linked remoteへのcore migration適用、Database型生成、RLS境界検証
- Email + PasswordによるSignup / Login / Logout
- SQLiteからのsession復元とAuth state購読
- Expo Routerの認証済み・未認証保護ルート
- 生成Database型を使ったSupabase GoalRepository実装
- ログイン中ユーザーのGoal一覧・作成・更新・削除
- Goal入力validation、Loading / Empty / Error状態、二重送信防止
- 開発ガイド

未実装のもの:

- Task CRUD実装と画面接続
- Today画面の実データ接続
- 確認メールからアプリへ戻るDeep Link、Password reset、OAuth
- 端末カレンダー権限・予定取得・空き時間算出
- OpenAI API、Planner schema、計画生成・再計画

## 依存バージョンについて

`package.json` のpeer-version overridesは、npmがExpo Routerの任意peerをSDK 57互換範囲外の
最新版で解決することを防ぐため、Expo SDKが指定する互換バージョンへ固定しています。

ESLintは、`eslint-config-expo` が利用するプラグインのpeer範囲に合わせてv9へ固定しています。
Expo SDK更新時には、overridesとあわせて再確認します。
