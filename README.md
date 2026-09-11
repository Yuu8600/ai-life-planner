# AI Life Planner

目標・Todo・端末カレンダー・実行実績をもとに、AIがその日の行動計画を提案・再計画する
日本語対応モバイルアプリです。

要件定義は [requirements-v0.1.md](docs/requirements/requirements-v0.1.md) を参照してください。

現在は **Milestone 0.5 (Development Foundation)** です。Expoアプリを起動できる最小画面と、
今後の機能を分離して実装するための土台・テスト環境だけを用意しています。Goal / Task /
Calendar / Planner、Supabase、端末カレンダー、OpenAIとの実通信はまだ実装していません。

## 技術構成

- React Native / Expo SDK 57
- TypeScript（strict mode）
- Expo Router
- ESLint（Expo flat config）
- Prettier
- Jest / React Native Testing Library

将来の採用予定はSupabase、`expo-calendar`、OpenAI APIです。これらのSDKは必要になる
Milestoneまで追加しません。

## セットアップ

前提としてNode.js `^22.13.0 || >=24` とnpm、および実行先に応じてExpo Goまたは
Android/iOSの開発環境が必要です。このNode.js範囲はReact Native Testing Library 14の要件に
合わせています。

```bash
npm install
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
│   ├── goals/             # Goal機能
│   ├── tasks/             # Task / Todo機能
│   ├── calendar/          # 端末カレンダーと空き時間
│   └── planner/           # Daily Planと再計画
├── services/              # Supabase・Calendar・OpenAIなど外部I/Oの境界
└── shared/
    ├── components/        # 機能に依存しない共通UI
    ├── config/            # アプリ共通設定
    └── types/             # 機能横断で共有する型
```

ルートや表示コンポーネントへビジネスロジックを直接置かず、機能固有の処理は各
`src/features/<feature>` に閉じ込めます。外部サービスへのアクセスは `src/services` を境界に
することで、UI・ドメインルール・インフラ実装を分離します。

## 環境変数

`.env.example` は将来必要になる変数名だけを示しています。Milestone 0.5では読み込みも通信も
行いません。ローカル値を用意するときは `.env.local` などの追跡対象外ファイルを使用します。

`EXPO_PUBLIC_` で始まる値はアプリへ埋め込まれるため秘密情報には使えません。
`OPENAI_API_KEY` は将来もモバイルアプリではなく、信頼できるサーバーまたはSupabase Edge
Functionだけで管理します。

## 現在のスコープ

Milestone 0 / 0.5で用意したもの:

- Expo + React Native + TypeScriptの初期構成
- Expo Routerと最小の初期画面
- TypeScript strict mode
- ESLint / Prettier
- 機能単位のディレクトリ構成
- 環境変数テンプレートとGit除外設定
- 要件定義書のバージョン管理用配置
- Jest / React Native Testing Libraryと初期画面のスモークテスト
- 開発ガイド

未実装のもの:

- Bottom navigationおよび各機能画面
- Supabaseプロジェクト、認証、DB、CRUD
- 端末カレンダー権限・予定取得・空き時間算出
- OpenAI API、Planner schema、計画生成・再計画

## 依存バージョンについて

`package.json` のpeer-version overridesは、npmがExpo Routerの任意peerをSDK 57互換範囲外の
最新版で解決することを防ぐため、Expo SDKが指定する互換バージョンへ固定しています。

ESLintは、`eslint-config-expo` が利用するプラグインのpeer範囲に合わせてv9へ固定しています。
Expo SDK更新時には、overridesとあわせて再確認します。
