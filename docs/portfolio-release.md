# Portfolio release preparation

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
本人の選択により、**メール非公開を優先する方針が確定**した。履歴整理の手順を用意し、実行・再検証が完了するまでPublic化しない。
この文書へ実メール・元の絶対pathは転載していない。

具体的な実行前手順は[Git履歴のプライバシー整理](history-privacy.md)に記載した。Public化より先に以下を整理する。

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

1. **確定したメール非公開方針に従い、履歴整理または公開用repositoryへの移行を先に完了する。** 手順の用意のみ完了しており、実行は別途確認後。
2. この公開準備branchをレビューし、push / PR → CI成功 → mainへmergeする。historyを変える方針なら、先にbranchの基点を調整する。
3. GitHubのDescription / Topicsを設定し、LICENSE・画像・公開予定branch / tag / PRの内容を最終確認する。
4. 公開方針の未解決事項がなくなってからrepositoryをPublicへ変更する。GitHub FreeでのPagesはpublic repositoryが対象。
5. Settings → Pages → SourceをGitHub Actionsへ設定する。
6. Actions → Web Demo Pages → Run workflow、branchはmainを選ぶ。
7. workflowの表示した実URLで、root / tasks / calendar / ai / today / settings、直接URL、reload、asset、生成・保存・完了・Skip・再計画を確認する。
8. Desktop / Mobileでconsoleと表示を確認し、READMEのDemo節とAbout Websiteへその実URLを追加する。
9. 次の作業としてPersonal Team Release buildを行う。Metro停止・Mac切断後のiPhone単体利用を別途検証する。

技術面の公開準備と履歴整理の手順は用意済み。メール非公開方針に対する履歴整理・再検証が未実施のため、現時点ではPublic化・Pages公開を保留する。
