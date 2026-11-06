# Personal Team Release / iPhone単体利用

確認日: 2026-11-06（Asia/Tokyo）。正式な開発元はPublic `Yuu8600/ai-life-planner`。
旧private archiveは開発元として使用せず、必要なローカル公開クライアント設定と既存署名情報の参照だけに使用した。

## 結果

**iPhone 16でMac / Metroなしの単体利用を確認した。**

Personal Team署名のRelease configurationをビルドし、同じbundleIdentifierの既存アプリへ上書きinstallした。
Mac接続中の回帰検証後、アプリを完全終了し、Metro / Expo CLIプロセス0件、8081のlistenerなしを確認した。
その後、本人からUSB解除・通常のネットワークで以下すべて正常との報告を受けた。

- ホーム画面のアイコンから起動。
- ログイン状態、Settings、Calendar、Todayの利用。
- RuleBased PlannerのPreview生成（この最終確認では保存不要）。
- iPhoneのlock → unlock → 復帰、アプリ完全終了 → 再起動。

USBを外す操作とMac接続のない状態の端末操作は本人による確認。
自動検証による確認と、本人による最終確認を区別している。
Supabase通信にはWi-Fi / モバイル通信が必要で、オフライン対応を追加したわけではない。

## 環境と再生成

- iPhone 16 / iOS 18.7.8、Developer Mode有効、既存ペアリングと署名証明書を再利用。
- Xcode 27.2、CocoaPods 1.17.0、Node 26.13.0、npm 11.20.0。
- Expo 57.0.32、React Native 0.86.3、Router 57.0.30、Calendar 57.0.6。
- build-properties 57.0.23、dev-client 57.0.21。今回依存version / lockfileの変更なし。
- bundleIdentifier: `com.uyu.ailifeplanner`。変更していない。

このcloneに生成済み`ios/`はなかった。先にapp.jsonとpluginsを確認してから、次を実行した。

```sh
npm ci
npx expo prebuild --clean --platform ios --no-install
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install --project-directory=ios
```

source-controlled configから次を再現できた。

- expo-build-propertiesの`ios.enableSceneSupport: true`。
- Info.plistのUIApplicationSceneManifestとEXExpoAppSceneDelegate。
- Calendarのフルアクセス・互換権限説明文。Reminders権限は追加していない。
- 既存bundleIdentifier、アイコン、Splash、Router構成。

`ios/`と`.env`は引き続きGit管理対象外。生成済みnative projectだけにあるTeam設定は
clean prebuildで失われるため、通常の再署名ではclean prebuildを繰り返さない。

## ローカル環境変数

新cloneには`.env`がなかったため、既存archiveから次の2項目だけを復元した。

- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Publishable形式の公開クライアントキーであることを確認し、OpenAI key / service_role / secret key /
database passwordは復元していない。実値はこの記録やGitへ記載しない。
Releaseのmain.jsbundleに両値が埋め込まれていることを、値を表示せず照合した。
環境変数を変更した場合は再buildが必要。Web Demoのexportは引き続き.env読込を無効にする。

## Release build / install

[Expo CLI公式手順](https://docs.expo.dev/more/expo-cli/)のRelease configurationとdevice指定を使用した。

```sh
npx expo run:ios --configuration Release --device --no-bundler --no-install
```

実行時は接続済みiPhone 16のUDIDを非表示で指定した。端末の表示名が製品名と異なる場合、
`--device "iPhone 16"`だけでは選択できないため、対話式の実機一覧から自分の端末を選ぶ。
既存のPersonal TeamとApple Development identityをExpo CLIが利用し、build / 上書きinstallが成功した。
アプリを削除してからinstallする操作は行っていない。

生成物を確認した結果:

- Release-iphoneos / AILifePlanner.app。
- main.jsbundleあり（3,535,085 bytes）、assetsあり。
- codesignのdeep / strict verify成功。
- embedded profileのLocalProvision=true。無料Personal Teamの開発用署名を使用。
- profile期限: **2026-11-12 13:47 JST**。今回既存profileを再利用したため、build日から新たに7日ではない。

Release configurationであってもPersonal TeamはApple Development署名を使用する。
Debug development clientを起動してMetroへ接続する構成とは区別する。
起動時に開発ランチャー・QR・Metro接続エラーへ入らず、SplashからアプリのTodayへ直接遷移した。
CLIログの`Waiting on http://localhost:8081`はサーバー起動の証拠ではなく、実際のlistenerとprocessで停止を確認した。

## Native / Core v1回帰検証

接続中の実機でXCTest UI操作と通常のアプリI/Oから確認した。DBを外部から直接書き換えていない。

| 項目                      | 結果                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Splash / Router / UIScene | Release cold launchでクラッシュせずTodayへ直接起動。タブ・Settings modal・再計画の遷移成功                |
| Auth / Supabase           | 上書きinstall後も既存sessionを復元。完全終了・再起動後もログイン不要でPlan / Settingsを取得               |
| Settings                  | Asia/Tokyo・08:00–23:00・20分を取得。20→25→20分を保存し、再起動後も20分を再取得                           |
| キーボード操作            | 元の20分へ戻す際、キーボード表示中に保存ボタンを1回押して成功を確認                                       |
| Calendar                  | 既存の許可状態で通常予定を読取。timezoneを維持して2枠の空き時間を計算                                     |
| Calendar foreground       | Homeへ退避後の再取得中表示と、予定・空き時間の再表示を確認                                                |
| 終日予定                  | 当日の実機Calendarに終日予定がなく、今回の日付確認は未実施。既存のunit / 過去実機検証を参照               |
| RuleBased / Preview       | 最新Calendar / Taskから3件配置・1件未配置。固定予定と非重複。600分のQA Taskは連続枠不足で未配置           |
| Skip                      | 既存QA用ActionをSkip。Action状態とActivity Logの追加を確認。通常Taskを完了扱いにしていない                |
| Replanning / Save         | Todayから開始し、最新Previewを承認保存。新しい3 ActionとTask / Goal対応をTodayで確認                      |
| Stale Preview Guard       | 確認中の時刻境界通過で古いPreviewを拒否。再生成から短い連続操作で承認すると保存成功                       |
| Activity Log              | 再計画後もQA用Skipと既存の完了履歴が残る                                                                  |
| Background / restart      | Calendarを開いてHomeへ退避・復帰して再取得。完全終了→Splash→Today→Settingsでもsession / Plan / 設定を保持 |
| USBなし / lock復帰        | 自動操作終了後、本人がUSBを解除してホーム起動・主要画面・Preview・lock復帰・再起動をすべて確認            |

既存の`e2e/ios/settings-keyboard-save.ad` replayは、キーボードで保存ボタンが画面外になったためstep 5で停止した。
保存ボタンをスクロール表示して手動UI操作による保存・元の値への復元を完了した。
数値fill時に検証ツールのread-back不一致も出たが、実画面で20を確認して保存し、再起動後に再取得した。
これらのreplay / selector失敗をアプリの保存失敗や、既存replay全成功として記録しない。
アプリ本体・Guardの条件・native dependencyの追加変更は不要だった。

今回QAでTodayのPlanを再計画後の3 Actionへ更新し、既存QA ActionのSkip履歴を1件追加した。
Settingsは元へ戻し、Calendar予定は作成・変更・削除していない。OpenAIは使用していない。

## 期限切れ後の最短再install

[AppleのPersonal Team説明](https://developer.apple.com/help/account/basics/about-your-developer-account)では、
無料profileは発行から7日で失効する。期限切れで起動できなくなったら、アプリを削除せずに次を行う。

1. iPhoneをMacへ接続し、ロック解除する。
2. 同じ開発cloneで次を実行し、自分のiPhoneを選ぶ。

   ```sh
   npm run ios:release
   ```

3. 上書きinstall後、USBを抜き、ホーム画面から起動する。Metro起動は不要。

このscriptは`expo run:ios --configuration Release --device --no-bundler`を実行する。
初回用に同じCLI・flagsのUDID指定実行は検証済み。署名が実際に失効した後のprofile更新はまだ未検証。
Xcodeの認証更新やprofile再発行が必要になりCLIが失敗する場合は、次の手順を使う。

1. `xed ios`でworkspaceを開く。
2. AILifePlanner targetのSigning & Capabilitiesで既存Personal Team / Automatically manage signingを確認。
   bundleIdentifierは変えない。
3. Product → Scheme → Edit Scheme → Run → Build ConfigurationをReleaseにし、自分のiPhoneを選んでRun。
   必要なprofile更新・Keychain許可・端末側の信頼は本人が行う。
4. 成功後にUSBを抜いて起動確認。以降は同じ生成済みiosで`npm run ios:release`を使う。

無料profile更新のために、毎回アプリ削除やclean prebuildをする必要はない。
Xcodeが同じ署名情報で上書きできない場合も、削除を先に試さず、Team / bundleIdentifier / profileを確認する。
有料Program、TestFlight、App Store、EAS Buildは使用していない。

## データへの影響

- 今回、同じTeam / bundleIdentifierで上書きinstallし、SQLiteの認証sessionが維持されることを実測した。
- 同じアプリとして通常の上書きinstallを行う場合、local dataを保持する。profileの失効自体はデータ削除ではない。
- アプリを削除するとSQLiteのsession等は失われる。再install後は再ログインが必要。
- Goals / Tasks / Plans / Activity LogはSupabase上にある。署名更新やinstall自体でサーバーの行は削除しない。
  同じアカウントへログインすれば再取得する。アプリ内の通常の編集・再計画・削除操作は別にデータを変更する。
- bundleIdentifierやTeamを変えると同じアプリとして更新できない場合があるため、再署名のために変更しない。

## 品質と残る範囲

npm ci、Expo Doctor（21/21）、Expo dependency check、typecheck、lint、format:check、
Jest（54 suites / 497 tests）、git diff --checkが成功した。
依存更新後の新しいNative Release buildと実機確認を今回実施した。

未確認: 実際の署名失効後の再発行、長期間の連続利用、終日予定の日付の今回の実機再検証、
端末timezone変更、オフライン、長時間background、OpenAI、他機種 / Android。
オフライン対応やCore v1仕様は変更していない。
