# AI Life Planner

目標・Todo・端末カレンダー・実行実績をもとに、AIがその日の行動計画を提案・再計画する
日本語対応モバイルアプリです。

要件定義は [requirements-v0.1.md](docs/requirements/requirements-v0.1.md) を参照してください。

現在は **Milestone 2A (Supabase Foundation)** です。Milestone 1の静的UIを維持したまま、
Supabase client、認証セッション永続化、DB migration、RLS、repository境界を追加しています。
Goal / Task CRUDの画面接続、端末カレンダー、OpenAIとの実通信はまだ実装していません。

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
├── app/                    # Expo Routerのルート。画面構成とナビゲーションのみ
├── features/
│   ├── today/             # 今日の計画サマリーとタイムライン
│   ├── goals/             # Goal一覧
│   ├── tasks/             # Task / Todo一覧
│   ├── calendar/          # 日表示の静的タイムライン
│   ├── ai-chat/           # 静的なAI相談画面
│   ├── settings/          # 計画の前提設定画面
│   └── planner/           # 後続Milestone向けの計画ドメイン
├── services/
│   └── supabase/          # client、環境変数検証、Auth基盤、生成DB型の配置先
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

`.env`はGit管理対象外です。未設定・不正なURLの場合、値そのものをログへ出さず、足りない環境
変数名が分かるエラーを返します。Supabase clientは利用時に初期化されるため、Milestone 1の
静的UIは`.env`なしでも起動できます。

`EXPO_PUBLIC_` で始まる値はアプリへ埋め込まれるため秘密情報には使えません。
`OPENAI_API_KEY` は将来もモバイルアプリではなく、信頼できるサーバーまたはSupabase Edge
Functionだけで管理します。

Supabaseの`service_role` keyはRLSを迂回できる秘密値です。モバイルアプリ、`.env`の
`EXPO_PUBLIC_`変数、リポジトリには絶対に配置しません。

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

Milestone 0 / 0.5 / 1 / 2Aで用意したもの:

- Expo + React Native + TypeScriptの初期構成
- Expo Routerと5つのBottom Tab
- TypeScript strict mode
- ESLint / Prettier
- 機能単位のディレクトリ構成
- 環境変数テンプレートとGit除外設定
- 要件定義書のバージョン管理用配置
- Today / Goals / Tasks / Calendar / AI / Settingsの静的画面
- ローカルダミーデータと機能単位のUIコンポーネント
- Jest / React Native Testing Libraryによるタブ構成とToday画面のテスト
- Supabase clientとSQLiteベースの認証セッション永続化設定
- profiles / goals / tasksのmigration、制約、RLS policy、明示的な権限
- GoalRepository / TaskRepositoryのinterface境界
- Supabase CLIと安全なDatabase型生成導線
- linked remoteへのcore migration適用、Database型生成、RLS境界検証
- 開発ガイド

未実装のもの:

- Login / Signup UI、Goal / Task CRUD実装と画面接続
- 端末カレンダー権限・予定取得・空き時間算出
- OpenAI API、Planner schema、計画生成・再計画

## 依存バージョンについて

`package.json` のpeer-version overridesは、npmがExpo Routerの任意peerをSDK 57互換範囲外の
最新版で解決することを防ぐため、Expo SDKが指定する互換バージョンへ固定しています。

ESLintは、`eslint-config-expo` が利用するプラグインのpeer範囲に合わせてv9へ固定しています。
Expo SDK更新時には、overridesとあわせて再確認します。
