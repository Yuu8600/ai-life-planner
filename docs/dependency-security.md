# Dependency security assessment

確認日: 2026-11-06。対象は公開用clean repositoryのmain。
元private repositoryおよびremoteは変更していない。公開・push・Pages deploymentは未実施。

## 判断

現在のソースをPublic repositoryとして公開し、現在の構成の静的Web Demoを配信することは可能と判断する。
criticalは解消した。残存highのdecoderはproduction bundleに含まれるが、現在のRouterの受信URL処理からは
呼ばれていない。残存項目を全てdevelopment-onlyと扱う判断ではない。
将来query-stringのparse / parseUrl / stringifyUrlやReact Navigationの標準getStateFromPathを直接使う場合は
この判断を再評価し、未信頼URLをdecoderへ渡す前に互換修正版または入力境界の対策が必要。

## npm audit

| 対象             | total | critical | high | moderate | low |
| ---------------- | ----: | -------: | ---: | -------: | --: |
| 更新前・全依存   |    34 |        1 |    8 |       16 |   9 |
| 更新前・omit=dev |    25 |        1 |    8 |        9 |   7 |
| 更新後・全依存   |    23 |        0 |    3 |       11 |   9 |
| 更新後・omit=dev |    14 |        0 |    3 |        4 |   7 |

これはauditの影響package集計で、独立した23種類の攻撃を意味しない。
例えば残存high 3件はdecoder / query-string / expo-routerという同一chain。
ExpoはCLIをdependenciesとして持ち、Router経由のpeer依存等もあるため、omit=devの件数は
そのままアプリのproduction実行時の脆弱性件数にならない。lockfileのdev区分と実際の呼び出しを区別した。

## Critical: shell-quote（修正済み）

- Advisory: [GHSA-pqg4-j6r4-53mv / CVE-2026-102422](https://github.com/advisories/GHSA-pqg4-j6r4-53mv)。Critical、CVSS 9.2。
- 影響範囲は1.8.4以上1.11.0未満。quoteのcomment tokenの後に攻撃者が制御する改行を含む文字列を置き、
  結果をshellで実行するとcommand injectionが可能。単にライブラリがインストールされているだけでは成立しない。
- chain: root → react-native 0.86.3 → react-devtools-core 6.1.5 → shell-quote。
  アプリのdirect dependencyではなくtransitive dependency。npm上はproduction側に到達する。
- 1.10.0 → **1.12.0**。親が許す^1.6.1内のminor更新で修正済み。特別なoverrideは追加していない。
- NativeはReact NativeのsetUpReactDevToolsで__DEV__ guard内からDevToolsを読み込む。
  release iOS bundleおよび静的Web bundleにはshell-quote / react-devtools-coreとも含まれなかった。
- タスク・Calendar・Web Demo入力をshell-quoteに渡すコードはない。
  Pagesは固定されたrepositoryをexportするbuildで、利用者入力をshellへ渡すサービスではない。
- 分類は主に **2（development tooling、利用条件下のriskが限定的）**。
  現アプリのproduction利用はadvisoryの攻撃条件に該当する経路を確認できず、5も補足的に当てはまる。
  ただし未修正版を一般に安全と扱わず、互換更新で実際に解消した。

## 安全な範囲で実施した更新

npm audit fix --ignore-scripts（forceなし）、expo install --fix、brace-expansionのrange内更新を行った。
Expo SDKは57のまま。React 19.2.3 / React Native 0.86.3は変更していない。

- Expo 57.0.23 → 57.0.32、Router 57.0.21 → 57.0.30、metro-runtime 57.0.15 → 57.0.18。
- Calendar 57.0.3 → 57.0.6、build-properties 57.0.22 → 57.0.23、dev-client 57.0.19 → 57.0.21、
  splash-screen 57.0.9 → 57.0.11、sqlite 57.0.3 → 57.0.4。
- constants 57.0.18 → 57.0.23、linking 57.0.10 → 57.0.13、jest-expo 57.0.5 → 57.0.6等も
  既存range内のSDK 57修正版へlockを更新した。package.jsonの最低patch変更はExpoが要求した5パッケージのみ。
- shell-quote 1.12.0、node-forge 1.4.3、source-map-js 1.2.2、brace-expansion 1.1.21 / 5.0.12等で解消。
  SDKの更新された親依存に従いglob 14.0.4、xcode 4.0.0、zod 4.6.7等も解決された。
  これらtransitiveのmajor差分はSDK 57 patchの上流manifestによるもので、rootのmajor更新や強制overrideではない。
- audit上、@expo/cli / config / config-plugins / metro-config、brace-expansion、node-forge、
  shell-quote、source-map-js、uuid、xcode、zodの11 packageのflagが解消した。

package.json / package-lock.jsonをレビューし、既存overrideは維持した。
アプリsrc / supabase / assets / app.json / app.config.ts / tests / Actionsに変更はない。

## 残存項目と実際の露出

| 根本package                        | 実際の用途                          | Web / Native release                                | 残す理由                                                                |
| ---------------------------------- | ----------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| decode-uri-component 0.2.2（high） | query-string 7.1.3経由のRouter依存  | 両bundleに含まれる。現在の受信URLは別パーサーを使用 | 修正版0.5.1はquery-string 7の^0.2.2外かつESM。安全なpatch/minor解決なし |
| glob 13.0.7（moderate）            | Expo fingerprintのfilesystem走査    | 両bundleに含まれない                                | 親が13系を指定。14.0.4への強制置換を避けた                              |
| minimatch 10.2.6（moderate）       | Expo fingerprint / ESLintのglob照合 | 両bundleに含まれない                                | 修正11.0.1はmajor。親rangeを跨ぐoverrideを避けた                        |
| deepmerge 4.3.1（low）             | Jestの設定merge                     | 両bundleに含まれない                                | advisoryに修正版なし。既知のrepository内設定を使用                      |

各根本項目が親へ波及しmoderate 11件、low 9件として集計される。
信頼できないPRのbuild/testは他の任意コードと同様に扱い、秘密情報や特権を与えない。

### decoderの確認根拠

[GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f)は、
未信頼の不正percent encodingをdecodeUriComponentへ渡すとCPUを占有するavailability問題。
[先行advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)も0.2.2に該当する。

現在のExpo RouterではgetLinkingConfig → link/linking → fork/getStateFromPath →
fork/getStateFromPath-forks.parseQueryParamsがnew URL(...).searchParamsを使用する。
query-stringへの直接呼び出しは現在の経路ではstringify（URIのエンコード）で、脆弱decodeを使わない。
React Navigationの標準getStateFromPathにはqueryString.parseが残るが、現在のRouterではforkが上書きする。
アプリsrcはこの標準パーサーやquery-stringを直接importしていない。

Web productionの生成JSとsource map付き検査用JSが同一であることを確認し、mapped breakpointで計測した。
不正percent encodingを含むqueryを付け、トップ / tasks / today / settingsを開き、各ロードでforkの
parseQueryParamsが4回動作し、decode-uri-componentおよび標準queryString.parseの箇所は0回だった。
4画面とも表示・操作用buttonを確認し、Runtime exceptionは0件。
これは検証した経路の証拠であり、将来の全利用方法の安全性を保証するものではない。
Nativeにも同じforkを使用するが、実機でのdecoder計測は行っていない。

### build / test依存

[glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)はAbortSignal後の走査継続、
[minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)は特定optimization設定と
悪意あるglob patternによるDoS。現在の固定repositoryのexport / lintには未信頼利用者のglob入力がない。
[deepmerge advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)はmerge結果のprototype poisoning。
現在のJest設定を利用する範囲で利用者由来objectをmergeするサービスにはなっていない。
Pagesの配信は静的ファイルであり、閲覧者によるserver-side Node.js処理はない。

## 互換性・検証

- npm ci成功。npm run typecheck / lint / format / format:check、git diff --check成功。
- npm run test:ci成功: **54 suites / 497 tests**（npm run testと同じJestをwatchなしで実行）。
- expo install --check: Dependencies are up to date。
- expo-doctor 1.21.6: **21/21 checks passed**。
- 通常のexpo export -p web、Pages用export:pages、verify:pages成功。
- iOS production JS / Hermes export成功。Web / iOSのsource mapで上記のmodule包含を確認した。
- WebはSupabase / expo-calendarを含まず、Nativeは両方を含む。Supabase versionとnative configは変更なし。
- Native module patchが入ったため、次回Native配布前には新しいdevelopment / release buildを作り、
  Pods / Xcode compileとCalendar権限・読取・Router・Supabaseの実機確認が必要。
  今回Xcodeでのバイナリbuild・実機E2Eは未実施。既存バイナリと更新後JSの混在は避ける。
- 検査用source mapは一時ディレクトリに出力し、配信用distおよびGitには含めていない。

監査件数・advisoryは確認日時点の状態。新しいadvisoryや利用経路の変更時に再評価する。
