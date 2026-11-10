# Web Demo / GitHub Pages

Web Demoは、Core v1の主要体験をアカウントやAPIキーの設定なしで試せるブラウザ版です。初期実装時の記録は2026年11月6日の結果です。公開準備時点の確認範囲は下記に分けて記載しています。

## GitHub Pagesの配信確認（2026年11月10日）

[公開サイト](https://yuu8600.github.io/ai-life-planner/)はHTTP 200でした。最新のPages実行ではbuildとdeployが成功しています。配信中のコミットはPR #4時点の `2541048db2996c602dca71c79f741d98f4dbb3f2` で、確認時点のmain（PR #18の `66aa5f8`）より前です。[配信ワークフロー](https://github.com/Yuu8600/ai-life-planner/actions/runs/42241690427)

- 配信中の版をChromeの375px・1440pxで開き、旧版の入口、計画の生成・プレビュー・保存、完了・スキップ、時計を15:00に進めての再計画と履歴保持、リセットを確認しました。
- `/today`、`/tasks`、`/goals`、`/calendar`、`/ai`、`/settings` は直接アクセスと再読み込みでHTTP 200でした。JavaScriptとインラインCSSは読み込まれ、重大なJavaScriptエラーや外部HTTP通信は観測されませんでした。ブラウザの既定のfavicon取得は404でした。
- 旧版では入口 → Tasks → Calendar → Plannerのあとにブラウザで戻ると入口に戻りました。最新mainのローカル静的版ではタブ移動を戻る・進むでたどれます。80px／時間の時間軸と翌日01:00のデモ時計もローカル版で確認しました。
- 最新版を公開するには、`Web Demo Pages` の `Run workflow` で現在の `main` を選び、新しい実行を開始します。過去の実行の再実行では元のコミットを使います。公開先で最新版を検証した後に、READMEとGitHubのAbout Websiteへ公開リンクを掲載します。

## 今回の公開準備で確認した範囲

2026年11月10日に、PR #17まで取り込んだproduction exportをローカルChromeで確認しました。

- 入口の「サンプルで計画を作ってみる」から直接進む経路と、タスク・カレンダーを確認してから進む経路を、375px幅と1440px幅で確認しました。
- 作成だけでは「今日」に表示されず、承認して保存した後に時間軸へ反映されます。完了・スキップ、時計を15:00に進めての再計画、再読み込みでの初期化も確認しました。
- 時間軸の1時間の目盛り間隔は80pxでした。静的成果物の検査と操作中のネットワーク監視で、外部API接続は見られませんでした。
- 撮影に使った表示幅と状態を画像一覧に記録しています。[スクリーンショット一覧](screenshots/README.md)

GitHub Pagesへ公開した後に確認する項目は[公開前チェック](portfolio-release.md#現在のpages公開前チェック)にまとめています。

## 最初の調査

- 変更前の `EXPO_NO_DOTENV=1 npx expo export -p web` は成功。従来は既定のsingle出力でindex.htmlのみ。
- React Native Web、React DOM、Metro runtimeは既に導入済み。依存パッケージの追加・更新は不要だった。
- 既存routeはSupabase Authで保護され、各routeがSupabase Repositoryを生成していた。
- ExpoCalendarRepositoryはiOS / Android専用。Webでは利用不可となり、Plannerの入力を作れなかった。
- Planner / Free Time / Validator / approvalはRepository interface越しに使えるため、業務ロジックの複製は不要。
- Pages用baseUrl、static出力、配信用workflowは存在しなかった。distと.envは既にgitignore対象。

## Architecture

`src/app`はplatform別のcompositionをre-exportする。`src/navigation/routes/*.tsx`がNative、
同名の`.web.tsx`がDemoを接続する。Platform分岐を実行時に選ぶだけでなく、Metroのmodule解決で分離するため、
Web bundleへNative側のAuth / Supabase / expo-calendar adapterを取り込まない。
Demoの画面接続は`src/navigation/DemoRoutes.tsx`、sessionの所有は`src/features/demo/DemoProvider.tsx`に置いた。

| 部分                       | Native                                     | Web Demo                                    |
| -------------------------- | ------------------------------------------ | ------------------------------------------- |
| Auth                       | 既存Supabase Auth / guard                  | 不要。入口からサンプル体験へ                |
| Goals / Tasks / Settings   | 既存Supabase Repository                    | DemoRepositoriesのメモリ内CRUD              |
| Calendar                   | 既存ExpoCalendarRepository                 | 固定のサンプル予定を日付区間で絞り込み      |
| Free Time / PlannerInput   | 共通Core                                   | 同じCore                                    |
| Provider / Validator       | RuleBased / optional OpenAI、共通Validator | 同じRuleBased / Validator。OpenAI選択肢なし |
| Preview / approval         | 最新データで再検証                         | 同じapproval処理でDemoの最新データを再検証  |
| Save / Today               | Supabase RPC / read model                  | 同日置換するメモリ内Plan / read model       |
| Complete / Skip / Activity | 既存RPC / snapshot履歴                     | メモリ内の状態変更とsnapshot履歴            |
| Replanning                 | DBの競合token付き置換                      | メモリ内のrevision token付き置換            |

既存のGoals、Tasks、Calendar、PlannerPreview、Today、Settings、履歴のUIも共用する。
SettingsのAccountSectionはNative側compositionから渡す。確認ダイアログはNativeでは従来のAlert、
Webではwindow.confirmを使い、キャンセル時には保存・削除・Skipを実行しない。
Desktopとフォームに最大幅を設け、Webだけタブバーの高さを調整した。

## Demo Data / clock / persistence

- Goal: TOEIC 730点。現在600点、目標730点、期限2026-12-06。
- Tasks: 英単語30分（高・当日期限）、Part 5演習30分（高・翌日期限）、リスニング45分（中）、模試復習60分（低）。
- Calendar: 大学09:00–10:30、授業13:00–14:30、サークル18:00–19:00。東京基準の固定instant。
- Settings: Asia/Tokyo、08:00–23:00、最小20分。サンプル日の空き時間は60 / 150 / 210 / 240分、合計660分。
- 時計: **2026-11-06 08:00 JSTに固定**。実際の訪問時刻が夜でも体験できる。「時計を15:00に進める」で再計画を試す。
- Settingsのtimezoneを変更すると、その同じinstantを設定timezoneの日付・時刻へ変換して計算する。
  予定自体を新timezoneの09:00へ移動する仕組みではない。ヘッダーのサンプル時計は常に東京表示。
- 保存先はProviderが所有する1つのDemoRepositoriesインスタンス。localStorage / Cookie / DBを使わない。
  route移動中は共有し、ページreload、タブ終了、リセットで破棄する。他のタブ・訪問者・Native利用者とは共有しない。
- CompleteはTaskも完了、SkipはTaskを未完了のまま保持する。同じ操作の再送で履歴を重複させない。
- 再計画は全置換。完了Taskを除外し、pendingならSkipしたTaskも候補にする。履歴は置換後も保持する。
- Task削除で旧Actionの参照をnullにする。旧nullable Actionは再計画へ持ち越さない。
- Preview承認の有効性は既存Validatorの規則に従う。所要時間の差異は従来どおりwarningであり、
  あらゆるTask編集を無条件に拒否するわけではない。候補消失・枠外・時刻経過などの不整合は拒否する。

## ローカルで開く

```sh
npm ci
npm run export:pages
npm run verify:pages
npm run preview:pages
```

`http://127.0.0.1:4173/ai-life-planner/` を開く。停止はCtrl+C。
previewサーバーはdistだけを返す。未知のpathへindex.htmlを返すSPA fallbackは実装していない。
extensionlessの既知routeを対応するHTMLへ解決し、サブパス・直接URLを確認できる。

通常の `npx expo export -p web` はbaseUrlなしのstatic出力。Pages向けには必ず`export:pages`を使う。
`app.config.ts`が`GITHUB_PAGES=1`のときだけ`experiments.baseUrl=/ai-life-planner`を追加する。
Native / 通常ローカル開発にはbaseUrlを追加しない。アプリ内のRouter hrefには手動でprefixを足さない。

## GitHub Pages公開手順（ユーザー操作）

採用方式はGitHub Actions。gh-pages branchや追加のnpm deploy依存を管理せず、distをPages artifactとして渡す。
Expo SDK 57の`web.output=static`で各routeのHTMLを生成し、サーバーruntimeは使わない。
public/.nojekyllもdistへコピーする。`_expo`等のunderscoreを含むassetをJekyllに除外させない。

1. 公開するmainのコミットと通常CIの成功を確認する。
2. GitHub repositoryの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする。
3. **Actions → Web Demo Pages → Run workflow → Branch: main** を選んで手動実行する。
4. workflow成功後、出力されたURLで入口と主要フローを確認する。`/tasks`、`/calendar`、`/ai`、`/today`、`/settings`の直接アクセス、再読み込み、静的ファイルの読み込みも確認する。
5. 検証済みのURLをREADMEとGitHubのAboutに掲載する。

workflowは`workflow_dispatch`のみ。push / PRで公開しない。main以外の手動実行もbuild jobで拒否する。
build jobでtypecheck・lint・format・Jest・Pages export・export検査を行い、成功したartifactだけをdeployする。
Pages書き込みとOIDC権限はdeploy jobのみ。環境名はgithub-pages。アプリ用secret / variableの登録は不要。
GitHub Freeでは公開repositoryが必要。現在のrepositoryの公開範囲やPages設定はこの作業では変更していない。

参照した公式資料:

- [Expo SDK 57 app config](https://docs.expo.dev/versions/v57.0.0/config/app/): static出力の定義。
- [Expo publishing websites](https://docs.expo.dev/guides/publishing-websites/): Project PagesのbaseUrlと.nojekyll。
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages): artifact、deploy job、権限。

## Security

- Web用compositionはAuthProvider、Supabase client、native Calendar、OpenAI Edge Function providerをimportしない。
- Pages exportはEXPO_NO_DOTENV / EXPO_NO_CLIENT_ENV_VARSを指定し、開発者の.envとEXPO_PUBLIC変数を読み込まない。
- Native / serverのsecretは新設せず、.envやcredentialを追跡対象へ追加していない。
- export検査で、Web bundleにSupabase設定名・Supabase host・Calendar permission API・server key識別子がないことを確認する。
- ブラウザ操作中もアプリの外部リクエストを監視する。production Supabaseへの読み書き・OpenAI呼び出しはない。
- Demoへの入力はこのタブのメモリ内のみ。公開サーバーへ保存する機能はない。

## Verification

以下は今回実行した確認。ブラウザは新しい一時profileのGoogle Chrome（headless）、Chrome DevTools Protocolで実際のDOM入力・クリック・画面キャプチャを使用した。既存の個人profileは使っていない。

| 確認                                               | 結果                                                                                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| typecheck / lint / format:check / git diff --check | 成功                                                                                                                                                 |
| Jest                                               | **54 suites / 497 tests成功**。既存Native回帰を含む                                                                                                  |
| 通常の `npx expo export -p web`                    | static export成功（.env読込を無効化して実行）                                                                                                        |
| `npm run export:pages` / `npm run verify:pages`    | 成功。16 routes、baseUrl付きasset参照、実asset、.nojekyll、日本語HTML、Native/server連携コードの除外を検査                                           |
| Native config                                      | iOS / Android / pluginsがapp.jsonと一致。通常起動にPages baseUrlが入らない                                                                           |
| 初回起動 / Auth                                    | 入口表示・ログイン不要でTasksとPlannerへ移動                                                                                                         |
| Goals / Tasks                                      | サンプルGoal / Tasks表示。Task「発音練習」20分を追加、25分へ編集してPlannerへ反映。削除とリセットも成功                                              |
| Calendar / Free Time                               | 3件の予定、4枠・合計660分を表示。初期4 Taskは08:00 / 08:30 / 10:30 / 11:15から配置                                                                   |
| Preview / Save / Today                             | Previewのみでは未保存、確認後保存。4件（追加Taskを含む試行では5件）をTodayで再取得                                                                   |
| Complete / Skip                                    | 英単語を完了しTaskも完了。Part 5をSkipしTaskはpending。履歴2件を表示                                                                                 |
| Replanning                                         | 時計を15:00へ進め、完了Taskを除外、Skip Taskを再配置。追加Taskありの5 Actionを4 Actionへ置換、2件の履歴を保持                                        |
| Settings                                           | 最小20→30分を保存し、閉じて開き直した後にも30分を再取得。リセット後は20分                                                                            |
| reload / direct URL                                | tasks / calendar / ai / today / settingsを直接開いて成功。loginは入口へredirect。tasksのreload後もサンプルが表示される                               |
| responsive                                         | **1440×1000、768×1024、390×844、375×667**でToday、Calendar、Preview、Goals/Tasksフォームをキャプチャして確認。横overflowなし、タブ名が全て表示される |
| browser errors / network                           | 主要操作中に重大なconsole error / uncaught例外なし。アプリの外部リクエストなし                                                                       |

新規unit / integrationテストは、サンプルからの共通Planner生成、CRUDと参照コピー、timezone / 日付区間、
同日置換、Complete / Skipの冪等性、snapshot履歴、nullable Task、再計画の競合とstale承認拒否、
Web確認ダイアログ、Demo時計での期限filterを対象とする。

ブラウザ確認で見つけた2点は修正済み: サンプルCalendarの凡例を「端末」から変更し、
小画面のタブ名が切れないようWebだけ高さ・行高を調整した。Task filterにはDemo時計を渡す。
初期実装時のPages確認状況は当時の記録です。[その後の配信確認](#github-pagesの配信確認2026年11月10日)

## 初期実装時の未確認範囲

- Nativeの業務ロジック、Calendar adapter、Supabase adapter / RPC / migration、API key配置は変更しない。
  route実装の配置を移したため、既存のrouteテスト・Auth・Calendar・保存・実行・再計画の回帰テストで確認する。
- 今回のWeb作業後のiPhone / Simulator再E2E、Android、Safari / Firefoxのブラウザ実機確認は対象外。
- Calendarの予定編集、実端末連携、OpenAI、永続ストレージ、複数タブ同期、offline起動はDemoの対象外。
