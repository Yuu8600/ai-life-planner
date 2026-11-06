# AI Life Planner

目標・Todo・端末カレンダー・実行実績をもとに、AIがその日の行動計画を提案・再計画する
日本語対応モバイルアプリです。

要件定義は [requirements-v0.1.md](docs/requirements/requirements-v0.1.md) を参照してください。

**Core v1 Native版**はiOS Simulator・iPhone実機で主要フローを確認済みです。Goals / Tasks / Calendarから
空き時間を計算し、API不要のRuleBased Plannerで生成・Preview・保存・Today・完了/スキップ・再計画まで利用できます。

**Web Demo**ではログイン不要で同じCoreロジックを試せます。サンプル予定とブラウザ内のメモリだけを使い、
Supabase・端末Calendar・OpenAIへ接続しません。GitHub Pages公開用の設定と手動workflowを用意しています。
実際の公開操作はまだ行っていません。

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

OpenAI API keyなしでもCore AppとRuleBased Plannerを利用できます。

## Web Demo（API・アカウント不要）

```bash
npm ci
npm run export:pages
npm run verify:pages
npm run preview:pages
```

ブラウザで `http://127.0.0.1:4173/ai-life-planner/` を開きます。サンプルTaskを確認し、Calendarの
空き時間からPlannerを生成、Previewを保存してTodayで完了・スキップできます。
「時計を15:00に進める」と再計画の変化を試せます。「デモをリセット」かページ再読み込みで初期状態に戻ります。

Web Demoの時計は**2026年11月6日08:00（東京）の固定サンプル**です。実際の現在時刻ではありません。
端末Calendarとの同期・ログイン・複数タブ間のデータ共有・リロード後の保存は行いません。
Native版の実データとDemoデータは別のadapterで扱います。

通常の `npx expo export -p web` はサイトルート向けのstatic export、`npm run export:pages` は
`/ai-life-planner/` 向けのexportです。公開手順と確認記録は [Web Demo guide](docs/web-demo.md) を参照してください。

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
│   └── planner/           # 空き時間計算と後続AI Planner向けの計画ドメイン
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
`OPENAI_API_KEY`と`OPENAI_MODEL`はモバイルアプリではなく、Supabase Edge Function Secretとしてのみ管理します。

Supabaseの`service_role` keyはRLSを迂回できる秘密値です。モバイルアプリ、`.env`の
`EXPO_PUBLIC_`変数、リポジトリには絶対に配置しません。

## Optional OpenAI Planner（4F-2ローカル実装）

AIタブでは`rule-based`を既定Providerとして使用します。OpenAIは明示選択した場合のみ利用します。
選択は画面session中だけ保持し、アプリ起動時は常にRuleBasedに戻ります。OpenAI未設定なら
選択肢を利用不可として表示します。Providerを切り替えると古いPreviewを破棄します。
OpenAI側の失敗時にRuleBasedへ自動で切り替えません。どちらのProviderも共通の
PlannerValidator、Preview、承認・保存処理を通ります。

`planner-generate`はローカル実装のみで、linked Supabaseには未deployです。GETは認証済み
ユーザーへ設定の有無に基づく`{available, reason?}`を返し、OpenAI APIは呼びません。POSTは
既存`PlannerInput`だけを受け、Edge FunctionからResponses APIのstrict JSON Schema形式で
生成します。mobileは返却値を`unknown`として扱い、共通Validatorで検証します。
`OPENAI_API_KEY`と`OPENAI_MODEL`が共に必要です。対応するモデルを選び、Edge Function側の
Secretとして設定してください。reasoning effortは低、timeoutは20秒、自動retryはありません。
API key、Supabase JWT、ユーザーの入力本文をログへ出しません。OpenAI利用時のみAPI使用量に
応じた料金が発生し、ChatGPT Plusなどの料金とは別です。OpenAI設定がなくてもCoreを試せます。

ローカル検証まではSecret設定・remote deploy・実APIリクエストを行いません。承認後に
Supabase DashboardのEdge Function Secretsで`OPENAI_API_KEY`と`OPENAI_MODEL`を設定します。
モデルにはResponses APIのStructured Outputsと`low` reasoningに対応するものを選びます
（コスト重視の候補例は`gpt-6-luna`。利用可能モデルと料金は設定時に公式資料で確認してください）。
その後`npx supabase functions deploy planner-generate`でdeployし、availabilityを確認してから
少額の実API検証を行う手順です。実際のkeyをCLI引数やGit管理ファイルに書かないでください。

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
繰り返し予定を受け取り、通常予定は`eventStart < dayEnd && eventEnd > dayStart`の半開区間で
絞り込みます。終日予定はUTC instantをprofile timezoneへ変換せず、date-onlyの開始日と
end-exclusive終了日で表示日を判定します。不正な日時のeventは正規化境界で個別に除外します。

連携は読み取り専用で、イベントの作成・更新・削除APIは呼びません。端末予定をSupabaseへ複製せず、
新しいtableやmigrationも追加していません。Androidでは`expo-calendar` 57.0.3のnative実装とconfig
pluginが`READ_CALENDAR`と`WRITE_CALENDAR`の両方を要求しますが、アプリの処理自体は読み取りだけです。
app configにはiOSのカレンダー利用目的文を設定し、使用しないRemindersの目的文は無効化しています。

## Free Time Calculation（Milestone 3C）

`src/features/planner` のCalculatorは、選択日、profile timezone、`planning_start`、
`planning_end`、`minimum_free_minutes`、正規化済みCalendar Eventを入力とし、UTC ISOの
planning window、merge済みbusy intervals、duration付きfree slotsを返します。Expo、React、
Supabase、UIに依存しないpure TypeScriptです。

通常予定はabsolute instantのままplanning windowへclampし、重複・包含・接するbusy intervalを
mergeします。`canceled`と`availability=free`はblockingせず、その他は安全側でblockingします。
対象日のblocking終日予定はplanning window全体を塞ぎます。計画時刻のUTC変換はTodayの
timezone utilityを再利用し、DSTによるoffset変化を固定offsetとして扱いません。Calendarタブは
同じCalculatorの結果を「空き時間」として表示します。

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

Milestone 0から4F-2のローカル実装までに用意したもの:

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
- profile timezoneのplanning window、blocking予定、終日予定からの空き時間算出
- busy intervalのclamp / merge、最小空き時間フィルタ、Calendarタブでの結果表示
- Provider-neutral Planner Contract、RuleBased Planner、共通Validator、Preview
- 承認したDaily Planのatomic保存と、保存済みPlanのToday表示
- Optional OpenAI Providerの選択UI、Edge通信adapter、認証付きFunctionとResponses API transport
- 開発ガイド

未実装のもの:

- 確認メールからアプリへ戻るDeep Link、Password reset、OAuth
- Calendar Eventと空き時間のTodayへの統合
- OpenAI用Edge Functionのremote deploy・実API検証、再計画

## 依存バージョンについて

`package.json` のpeer-version overridesは、npmがExpo Routerの任意peerをSDK 57互換範囲外の
最新版で解決することを防ぐため、Expo SDKが指定する互換バージョンへ固定しています。

ESLintは、`eslint-config-expo` が利用するプラグインのpeer範囲に合わせてv9へ固定しています。
Expo SDK更新時には、overridesとあわせて再確認します。
