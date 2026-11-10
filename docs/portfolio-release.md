# Portfolio release preparation

## 現在のPages公開前チェック

2026年11月11日の確認では、[GitHub PagesのWeb Demo](https://yuu8600.github.io/ai-life-planner/)に `1086990` が配信され、主要フローと6画面の直接アクセス・再読み込みが通りました。faviconの404はWeb設定で修正し、公開先の確認を残しています。[最新版の公開検証](web-demo.md#最新版の公開検証2026年11月11日)

faviconの修正を公開するには、`Web Demo Pages` の `Run workflow` から現在の `main` を選んで新規実行します。配信先で `/ai-life-planner/favicon.ico` の取得を確認した後、README冒頭を公開リンクに切り替えます。

GitHubのAboutのDescriptionは希望の文面で、Websiteは空欄でした。公開URLを載せるときは、リポジトリの **Code → Aboutの歯車 → Website** に `https://yuu8600.github.io/ai-life-planner/` を入力して **Save changes** を押します。

1. 公開に使う `main` のコミットと通常CIの成功、GitHubのSettings → Pagesでの公開元を確認する。
2. 公開を決めたら、Actionsの `Web Demo Pages` を `main` から手動実行し、公開ジョブが成功したことを確認する。
3. 出力されたURLで入口、JavaScriptや画像などの静的ファイル、`/tasks`・`/calendar`・`/ai`・`/today`・`/settings` の直接表示と再読み込みを確認する。
4. スマホ幅・PC幅で計画の作成・保存・実行・再計画を試し、外部APIへの通信がないことを確認する。
5. 動作確認した公開URLをREADMEとGitHubのAbout Websiteに登録する。

Step 10の実機確認には、USBを外した状態での起動と通信、VoiceOver、文字拡大などが残っています。公開を判断する際は、残っている実機確認の結果も確認します。[実機とブラウザでの確認範囲](portfolio.md#実機とブラウザでの確認範囲)

以下の監査・履歴整理と公開用リポジトリの初回作成手順は、2026年11月6日時点の記録です。

## 公開用clean historyの検証結果（2026-11-06）

元private repositoryを変更せず、独立したコピーをgit-filter-repo v2.47.0で整理した。
元の37 commitは全て保持し、親子関係・メッセージ・Author / Committerの日時も保持した。
作者の旧メールをAuthor 35件・Committer 31件で確認済みGitHub noreplyへ変更し、名前とGitHub botのidentityは維持した。
旧macOSローカルパスは過去の検証docsの2箇所で相対化。Windowsの個人パスは全履歴から検出されなかった。

公開用mainの整理直後のtreeは元の最新HEADと完全一致した。その後、このファイルとhistory-privacy.mdだけを
実行済みの監査記録へ更新した。src / supabase / assets / tests / app・package設定 / README / Actionsは元と一致する。
37件の整理済み開発commitに、この監査記録のcommitを1件追加して公開用履歴とする。

- 公開用refはmainのみ。tag・古い作業branch・remote-tracking ref・remote設定なし。
- 生のcommit metadataと全blobを検査し、作者の個人メール・macOS / Windowsの個人パスを検出せず。
- 予約example domainの架空fixtureと、第三者packageのlicenseにある公開連絡先は保持する。
- Gitleaksのcurrent tree / full history検査は検出0件。未検出のsecretを新たに見つけた場合は公開を止める。
- 元private側のPR・履歴は保持する。backup bundle・置換表・旧commit対応表は公開用repositoryの外に保管する。
- 新しいGitHub repositoryの作成・rename・push・Public化・Pages公開はまだ行っていない。

品質チェックではnpm ci、typecheck、lint、format / format:check、Jest（watch無効、54 suites / 497 tests）、
git diff --check、Pages export / verify:pagesが成功した。配信用distから生成・保存・Complete / Skip・履歴・
再計画・mobile表示・reload・直接URLも再確認した。ブラウザの重大なconsole error・アプリ外部通信は検出しなかった。

### 依存パッケージ監査（更新済み）

privacy cleanup時点では全依存34件（critical 1）だった。その後SDK 57の互換更新を実施し、
全依存23件（critical 0 / high 3 / moderate 11 / low 9）、omit=dev 14件になった。
criticalのshell-quoteは修正済み。残存highのdecoderはbundleに含まれるが、現在のRouterの
受信URL処理はURLSearchParamsを使用し、検証経路から呼ばれなかった。
公開可否・残存項目・Native再buildの検証限界は[依存監査の詳細](dependency-security.md)を参照。
秘密情報の検出0件は、アプリの脆弱性0件を意味しない。

以下の監査記録は元private repositoryを調べた当時の状態も含む。「個人メールが残る」は元private側の記録であり、
今回検証した公開用clean historyに同じ値が残っていることを意味しない。

確認日: 2026-11-06（Asia/Tokyo）。新機能追加・Native業務ロジック変更は行わず、
README、公開画像、docs導線、License表記、GitHub用の品質CIを整えた。
repositoryのPublic化・push・PR作成・merge・GitHub Pages公開・remote history rewriteは実行していない。

## 調査した基点

- 開始branch: feat/web-demo、HEAD b02f9a1、未コミット変更なし。
- GitHub側mainとb02f9a1を比較し、Web Demoがmainの祖先で、ファイル差分がないことを確認。
- originをfetchし、mainのmerge commit ba78129を確認。これを基点にdocs/portfolio-releaseを作成。
- READMEは開発段階の説明が長く、現在実装済みのReplanningを未実装とする古い記述も残っていた。
- LICENSEはMITで、Expo由来のcopyright noticeがあった。MIT本文とExpo表記は保持し、アプリ作者のGitHub handleを追加。
- 既存の追跡画像はassetsのstarter icon類6枚で、公開用screenshotsはなかった。

## 今回の成果物

- README: Demo → 背景 → Native / Web機能比較 → flow diagram → 主要画像 → stack / 設計 → 検証 → setup / Security。
- 詳細の開発手順は[development](development.md)、コードの入口は[architecture](architecture.md)、記録への入口は[docs index](README.md)へ。
- [公開用Web画像6枚](screenshots/README.md)。READMEにはToday / Preview / Calendarの3枚のみ掲載。
- 検証記録の個人環境の絶対pathを相対pathへ変更。要件定義の内容・過去の検証結果は改変しない。
- .gitignoreへ一般的なlog除外を追加。既存の.env、dist、cache、生成ios / android、署名鍵 / profileの除外は保持。
- PR / main向けの軽量CIを追加。typecheck・lint・format・Jestのみで、deploy / DB操作は行わない。

## Security audit

| 対象                      | 方法と結果                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 現在の公開対象ファイル    | git ls-filesと未追跡・非ignoredファイルから一時snapshotを作成。Gitleaks 8.30.1で検出0件                                                                     |
| Git履歴                   | fetch済み全refsの35 commit（基点時点）。Gitleaksの全branch検査で31件の非merge commitの差分、約1.91MBを走査し検出0件                                         |
| Git object補完検査        | 到達不能blobを含むローカル全522 blobを読み、private key、OpenAI / Supabase / GitHub / AWS token、credential URL、JWT等の既知patternを検査。実secret検出なし |
| .env / .env.example       | 実.envはignored・未追跡。変数名はclient用URLとPublishable Keyのみ。値を出力・記録しない。.env.exampleは空の変数名のみ                                       |
| 履歴内のファイル名        | 実.env、private key、署名profile、auth dump、生成dist / native projectの追跡を検出せず。.env.exampleは意図したtemplate                                      |
| Native / server           | OpenAIはEdge Function Secret経由。server credentialをclientへ配置する変更なし                                                                               |
| Web export                | Pages用exportとverify:pagesでbaseUrl / route / asset / .nojekyll、日本語HTML、Native / server接続コードの除外を確認                                         |
| ログ / fixture / comments | 実access token・refresh token・DB passwordの埋め込みを検出せず。予約example domainや固定UUIDのfixtureは保持                                                 |

Gitleaksは公式releaseのSHA-256 checksumを照合して一時ディレクトリで実行した。
scanはローカルで行い、repository内容を外部scannerへ送信していない。reportもrepositoryへ含めない。

この検査でcredential rotationが必要な実secretは見つかっていない。
現在の根拠からsecretを理由にhistory rewriteを行う必要は認められない。
pattern検出による監査であり、未知形式の秘密情報の不存在を保証するものではない。
GitHubのPR本文・Actions log / artifact・外部clone・他のrepositoryは対象外。

## Privacy audit / メール非公開の方針

現在の公開対象本文に、個人メール、ユーザー固有の絶対path、実remote Supabase host、private LAN URLを検出していない。
package-lock内の第三者packageのlicense表記に含まれる連絡先は作者本人の情報ではなく、そのまま保持した。
supabase/config.tomlのproject_idはローカルプロジェクト名で、remote project referenceではない。

全6枚の公開用画像を目視確認し、個人Calendar・実名・メール・APIキー・接続先を含まないことを確認。
starter assetsのXMP等にも個人メール・ローカルpath・GPS・creatorの個人情報は見つからなかった。

**既存Git履歴のAuthor / Committerには個人のGmailアドレスが残っている。**
また、相対化した旧検証記録の元の絶対pathは過去commitに残る。
現在のファイルだけを修正しても、これらをGit履歴から除去したことにはならない。
本人の選択により、**メール非公開を優先する方針が確定**した。この方針に基づき公開用コピーを整理・再検証した。元private repositoryはPublicへ変更しない。
この文書へ実メール・元の絶対pathは転載していない。

実施した手順と公開先への引き継ぎは[Git履歴のプライバシー整理](history-privacy.md)に記載した。以下は初回監査時の整理方針。

1. GitHub個人設定のEmailsで **Keep my email addresses private** と、メール露出を含むpushのブロックを設定する。
2. 今後のローカルcommitはGitHub提供のnoreply addressを使う。現在の接続アカウントID / loginで確認した形式は
   `207811593+Yuu8600@users.noreply.github.com`。このrepositoryだけのローカル設定として反映済み。global設定は変更していない。
3. 過去履歴は別途、バックアップ・全公開予定refs・PR参照を含む整理方針を決める。
   元repositoryを保持し、履歴を引き継がない公開用repositoryを作る方法も選択肢となる。
4. 既存remoteの履歴を変更する場合は、対象branch / tag、hash変更、他clone、PR参照への影響をレビューし、
   ユーザーが明示承認した別作業として行う。今回この操作は行わない。

git configの変更や.mailmapだけでは、過去commitの生のメールは消えない。
履歴rewriteをした場合も外部clone等まで消えるわけではない。
今回の新しいcommitにはnoreply identityを使用し、新たな個人メールを増やさない。

参考: [GitHubのcommit email設定](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)、
[履歴からsensitive dataを除く際の影響](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)。

## GitHub repository metadata案

Description:

> Calendar-aware daily planner that schedules goal-driven tasks into free time. React Native app with a no-login web demo.

Topics:

`react-native` / `expo` / `typescript` / `supabase` / `react-native-web` / `planner` / `productivity` / `portfolio`

repositoryのAboutではREADMEと同じ対象範囲を説明し、Web Demoの初回公開成功後にWebsiteへ実URLを登録する。
まだ稼働していないURLを公開済みリンクとして掲載しない。visibility / Description / Topicsのremote設定は今回変更していない。
mainの保護を設定するなら、PR CIのquality jobが成功してからmergeする運用を推奨する。

## GitHub Pagesの確認

- web.output: static。server runtime不要。
- Pages用export時だけbaseUrlを/ai-life-plannerへ設定し、通常のNative / ローカルWebへは適用しない。
- public/.nojekyll、distのPages artifact、build後のdeploy jobあり。
- Pages workflowはworkflow_dispatchのみで、main以外の実行を拒否する。
- DB / OpenAIのsecret登録不要。Pages readはbuild、Pages write / OIDCはdeploy jobだけへ付与。
- 通常CIにdeploy権限はない。既存Pages workflowの自動公開条件も追加していない。
- GitHub上でのCI / Pages workflowは今回実行していない。

## Verification

- typecheck、lint、format:check、Jest **54 suites / 497 tests**、git diff --check成功。
- npm run export:pages / npm run verify:pages成功。static route 16件とasset参照を検査。
- production distのサンプルGoal / Tasks、Calendar / Free Time、RuleBased生成、保存前Preview、Save → Todayを再操作し、公開画像を撮影。
- 撮影時のconsole error / uncaught exception・アプリの外部通信は0件。
- README / docsのローカルリンク・画像参照を確認。MermaidはGitHubが対応するflowchart形式を使用。
- Native source / Core / DB / dependencyは変更しないため、今回iPhone完全E2Eは再実行しない。
- CI jobの実行結果と、公開GitHub Pagesの直接URL / reloadはpush・公開後の最終確認。

## ユーザーが行う順番

1. 元のGitHub repositoryをprivateのままai-life-planner-dev等へrenameする。削除・force rewriteはしない。
2. 元の開発cloneのoriginをrename後のprivate URLへ変更する。同じ名前の新repositoryを作る前に行い、旧履歴の誤pushを防ぐ。
3. GitHubに空の公開用Yuu8600/ai-life-plannerを作る。README / LICENSE / .gitignoreを自動生成しない。
4. **検証済みの公開用clean repositoryからだけ**、新しいremoteを設定してmainを通常pushする。mirror / force pushや旧cloneからのpushはしない。
5. CI成功を確認し、Description / Topicsを設定する。公開用main以外のrefs・履歴を追加しない。
6. Settings → Pages → SourceをGitHub Actionsへ設定し、Web Demo Pagesをmainで手動実行する。
7. https://Yuu8600.github.io/ai-life-planner/でasset、直接URL、reload、生成・保存・完了・Skip・再計画、Desktop / Mobile表示を確認する。
8. READMEのDemo節とAbout Websiteへ検証した実URLを掲載する。以後、公開側へ反映する変更は整理済み履歴を基点にする。
9. Personal Team Release buildによるMetro停止・Mac切断後のiPhone単体利用は別の検証として進める。

ローカルの履歴整理・privacy検証は公開用コピーで完了した。品質チェックの最終結果を確認してから、
ユーザーの操作で新しい公開用repositoryへmainを通常pushする。既存private repositoryのPublic化は不要。
