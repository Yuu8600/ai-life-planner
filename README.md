# AI Life Planner

目標・Todo・端末カレンダー・実行実績をもとに、AIがその日の行動計画を提案・再計画する
日本語対応モバイルアプリです。

要件定義は [requirements-v0.1.md](docs/requirements/requirements-v0.1.md) を参照してください。

現在は **Milestone 3B (Device Calendar Integration)** まで実装済みです。Goals / Tasks CRUD、
Todayの`planned_actions`表示、Settingsのプロフィール計画設定に加え、Calendarタブで端末の予定を
読み取り専用表示できます。空き時間計算とAI画面のOpenAI通信はまだ実装していません。

## 技術構成

- React Native / Expo SDK 57
- TypeScript（strict mode）
- Expo Router
- Supabase JS / Supabase CLI
- Expo SQLite（認証セッション保存）
- Expo Calendar（端末予定の読み取り）
- Expo development client
- ESLint（Expo flat config）
- Prettier
- Jest / React Native Testing Library

OpenAI APIは、対応するMilestoneまで追加しません。

## セットアップ

前提としてNode.js `^22.13.0 || >=24` とnpm、およびAndroid/iOSの開発環境が必要です。
このNode.js範囲はReact Native Testing Library 14の要件に合わせています。Calendar連携は
Expo Goでは利用できないため、development buildを使用します。

```bash
npm install
npm run typecheck
npm run android:dev
```

`android:dev`はCNGでAndroid native projectを生成し、接続中のEmulatorへdevelopment buildを
インストールして起動します。native依存や`app.json`を変更していない2回目以降は、次でMetroを
起動してインストール済みbuildへ接続できます。

```bash
npm run start:dev
```

通常の`npm start` / `npm run android`も残しており、インストール済みdevelopment buildへの接続に
利用できます。ただしExpo GoではCalendar APIを確認できません。`ios`のローカルシミュレーター
実行にはmacOSが必要です。

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
│   ├── tasks/             # Taskの状態管理、validation、CRUD UI、repository契約
│   ├── calendar/          # 端末Calendarの契約、正規化、権限・日付状態、読み取り専用UI
│   ├── ai-chat/           # 静的なAI相談画面
│   ├── settings/          # Profile計画設定の状態管理、validation、編集UI、repository契約
│   └── planner/           # 後続Milestone向けの計画ドメイン
├── services/
│   ├── calendar/          # expo-calendar adapter
│   └── supabase/          # client、Auth、生成DB型、Supabase repository実装
└── shared/
    ├── components/        # 機能に依存しない共通UI
    ├── config/            # アプリ共通設定
    └── types/             # 機能横断で共有する型
supabase/
├── config.toml            # Supabase CLIのローカル設定
├── fixtures/development/  # 明示実行する開発確認用SQL（自動seed対象外）
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
接続設定エラーを表示します。認証、Goals / Tasks CRUD、Todayの実データ表示、SettingsのProfile編集を
利用するには、有効なSupabase設定とログインが必要です。

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
npx supabase db push --dry-run
npm run supabase:db:push
npm run supabase:types:linked
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

## Tasks CRUD

Tasksタブはログイン中ユーザーの`public.tasks`だけを読み込みます。「タスクを追加」から登録し、
一覧の「編集」「削除」から更新・削除できます。作成時の`user_id`はAuth sessionのユーザーIDを
repositoryが設定し、読み取り・更新・削除も明示的な`user_id`条件とRLS policyで保護します。

タイトルと1分以上の整数の所要時間は必須です。期限は`YYYY-MM-DD`、優先度は高・中・低、状態は
未予定・予定済み・完了・スキップから選択します。Taskは「Goalなし」またはログイン中ユーザー
自身のGoalへ関連付けられます。Goalを削除した場合、DBの複合外部キーによりTaskは残り、
`goal_id`だけが`NULL`になります。

## Today（Milestone 2B-4）

Todayタブはログイン中ユーザーの`public.profiles.timezone`を取得し、そのローカル日の00:00以上・
翌日00:00未満をUTCの半開区間へ変換して、`planned_actions.start_at`で絞り込みます。
`tasks.deadline`は使用しません。無効なtimezoneは暗黙に端末timezoneへ置き換えず、安全な日本語
エラーとして表示します。

Action自身が`title`を保持するため、関連Taskの削除で`task_id`が`NULL`になっても予定内容は残り
ます。Taskが存在する場合はTask名と、そのTaskに紐づくGoal名も表示します。Calendar Eventは
端末カレンダー連携のMilestoneまでTodayへ表示しません。

AI計画生成を実装する前の手動確認には、
`supabase/fixtures/development/create_today_planned_action.sql`を使用できます。このSQLは自動seed
対象外で、UUID未置換時は書き込み前に停止します。remote migration適用後、開発用Supabaseの
SQL Editorへ内容をコピーし、先頭の`fixture_user_id`だけを確認対象の`public.profiles.id`へ
置き換えて実行してください。既存の自分のTaskがあれば関連付け、なければ`task_id = NULL`で
当日18:00〜18:30のActionを冪等に作成します。

## Settings（Milestone 3A）

Settings画面はログイン中ユーザーの`public.profiles`から`timezone`、`planning_start`、
`planning_end`、`minimum_free_minutes`を読み込み、この4項目だけを更新します。PostgreSQLの
`time`値は取得時に`HH:mm`へ変換し、保存時は秒を`:00`に正規化します。

timezoneは標準の`Intl.DateTimeFormat`でIANA timezoneとして検証します。活動時間は同日内の
`planning_start < planning_end`、最小空き時間はPostgreSQL `integer`の範囲に収まる1以上の整数が
必要です。保存結果はSupabaseから返されたrowで画面へ同期します。Settingsを閉じてTodayへ戻ると
Todayを再取得するため、変更後のtimezoneがローカル日付判定に使われます。

## Device Calendar（Milestone 3B）

Calendarタブは、ログイン中ユーザーの`profiles.timezone`を3AのSettings repositoryから取得し、
そのtimezoneにおける選択日のUTC境界を使って端末予定を読み取ります。日付は前日・今日・翌日へ
移動できます。権限要求はCalendarタブのボタンを押したときだけ行い、拒否、API利用不可、
calendar 0件、event 0件、取得失敗をそれぞれ画面で扱います。

`CalendarRepository`の実装だけが`expo-calendar`へ依存します。SDK 57向けの新しい安定APIである
`getCalendarPermissions`、`requestCalendarPermissions`、`getCalendars`、`listEvents`を使用し、
deprecatedな`*Async` legacy APIは使用しません。イベントはISO 8601のstart/end instant、
`allDay`、`availability`、event timezone、calendar情報へ正規化します。platformが期間内へ展開した
繰り返し予定を受け取り、アプリ側でも`eventStart < dayEnd && eventEnd > dayStart`の半開区間で
絞り込みます。不正な日時のeventは正規化境界で個別に除外します。

連携は読み取り専用で、イベントの作成・更新・削除APIは呼びません。端末予定をSupabaseへ複製せず、
新しいtableやmigrationも追加していません。Androidでは`expo-calendar` 57.0.3のnative実装とconfig
pluginが`READ_CALENDAR`と`WRITE_CALENDAR`の両方を要求しますが、アプリの処理自体は読み取りだけです。
app configにはiOSのカレンダー利用目的文を設定し、使用しないRemindersの目的文は無効化しています。

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

Milestone 2B-4 migration適用後は、型を再生成してから追加検証も実行します。

```bash
npm run supabase:types:linked
npm run supabase:verify:linked:2b4
```

TodayのSupabase adapterは生成済みDatabase型から`daily_plans`、`planned_actions`、`tasks`、
`goals`のRow型を参照します。Supabase clientは同じ生成型のInsert / Update型も使用するため、
schema変更後は型再生成とtypecheckを必ずセットで実行します。

## 現在のスコープ

Milestone 0 / 0.5 / 1 / 2A / 2B-1 / 2B-2 / 2B-3 / 2B-4 / 3A / 3Bで用意したもの:

- Expo + React Native + TypeScriptの初期構成
- Expo Routerと5つのBottom Tab
- TypeScript strict mode
- ESLint / Prettier
- 機能単位のディレクトリ構成
- 環境変数テンプレートとGit除外設定
- 要件定義書のバージョン管理用配置
- Supabase実データのToday画面とSettings編集画面、端末予定を表示するCalendar画面、静的AI画面、Goals / Tasks CRUD画面
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
- 生成Database型を使ったSupabase TaskRepository実装
- ログイン中ユーザーのTask一覧・作成・更新・削除と任意のGoal関連付け
- Task入力validation、Loading / Empty / Error状態、二重送信防止
- daily_plans / planned_actionsの新規migration、複合FK、制約、RLS、検証SQL
- profile timezone基準のToday RepositoryとLoading / Empty / Error / Retry状態
- TodayのCalendarダミー削除とTask / Goal情報を含むAction表示
- Profile計画設定のRepository、Supabase adapter、入力validation、Loading / Error / Save状態
- Settingsからのtimezone変更後にTodayを再取得するフォーカス更新
- Calendar権限、event calendar一覧、指定日のevent occurrence取得を分離したrepository adapter
- Expo型に依存しないCalendar Event model、availability保持、半開区間intersection、不正event除外
- profile timezone基準のCalendar日付移動とLoading / Permission / Empty / Error / Retry状態
- Expo Go非対応のCalendar APIを確認するdevelopment build導線
- 開発ガイド

未実装のもの:

- 確認メールからアプリへ戻るDeep Link、Password reset、OAuth
- Calendar Eventからの空き時間算出とTodayへの統合
- OpenAI API、Planner schema、計画生成・再計画

## 依存バージョンについて

`package.json` のpeer-version overridesは、npmがExpo Routerの任意peerをSDK 57互換範囲外の
最新版で解決することを防ぐため、Expo SDKが指定する互換バージョンへ固定しています。

ESLintは、`eslint-config-expo` が利用するプラグインのpeer範囲に合わせてv9へ固定しています。
Expo SDK更新時には、overridesとあわせて再確認します。
