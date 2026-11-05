# Core v1 iPhone実機確認

実施日: 2026-11-05（Asia/Tokyo）。iPhone 16 / iOS 18.7.8、Xcode 27.2、
Expo SDK 57.0.23のdevelopment buildで確認した。Simulator確認記録は
`ios-core-v1-e2e-verification.md`を参照。

## 導入と開発環境

無料Apple AccountのPersonal Teamで署名、USB接続でインストール・起動できた。
有料Apple Developer Program、EAS Build、App Store配布は使用していない。
bundleIdentifierは`com.uyu.ailifeplanner`を維持した。
expo-dev-client、expo-calendar、Scene対応pluginも変更していない。

- XcodeのApple Accountsへ本人がサインインし、アプリtargetのTeamをPersonal Teamに設定した。
- iPhoneのペアリング・コンピュータの信頼、Developer Modeの有効化と再起動を本人が行った。
- 初回の署名はキーチェーンへのアクセス確認で待機した。本人がMacのログインパスワードで許可後、ビルドが成功した。
- インストール後はiPhoneの「設定 → 一般 → VPNとデバイス管理」で本人が開発者を信頼し、起動できた。
- MetroはLANの8081番で起動し、同じWi-FiのiPhoneからJavaScript接続を確認した。
- Supabaseの認証情報は本人が端末へ直接入力した。パスワード・トークンの取り出しやアプリ外からのDB更新は行っていない。

native projectはCNGで生成した`ios/`を使用し、Git管理対象外のまま。
Teamの設定はローカルのnative projectだけに保持し、個人用のTeam IDをapp.jsonへ追加していない。
`prebuild --clean`するとローカルのSigning設定は再設定が必要になる。

### 次回の最短起動手順

1. iPhoneを接続・ロック解除し、Macと同じWi-Fiに接続する。
2. ソースフォルダでMetroを起動する。

   ```sh
   cd ai-life-planner
   npm run start:dev -- --host lan --port 8081
   ```

3. 別のターミナルで実機を選択して起動する。

   ```sh
   cd ai-life-planner
   npm run ios -- --device --no-bundler
   ```

4. 必要ならdevelopment clientでこのMacのMetroを選び、ローカルネットワークへのアクセスを許可する。

初回は先に`ios/AILifePlanner.xcworkspace`をXcodeで開き、AILifePlanner targetの
Signing & CapabilitiesでAutomatically manage signingと自分のPersonal Teamを設定する。
今回、Expo CLIは既存Teamを検出した際にプロファイル作成のオプションを付けず、
開発用プロファイル未作成で失敗した。Xcodeの自動Signingによる作成を許可したビルドで解消した。
同じ状態になった場合は、Teamを設定済みの状態で次を実行できる。

```sh
xcodebuild -workspace ios/AILifePlanner.xcworkspace \
  -scheme AILifePlanner -configuration Debug \
  -destination 'id=<IPHONE_UDID>' \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  CODE_SIGN_STYLE=Automatic build
```

無料Personal Teamの開発用プロファイルは発行から7日で失効するため、期限切れ時は
Xcodeで更新して再ビルド・インストールする。今回のDebug development buildはMetro接続を前提とし、
Macから離れた場所で単体起動する常用構成はまだ確認していない。

参考: [Apple AccountとPersonal Team](https://developer.apple.com/help/account/basics/about-your-developer-account)、
[Xcodeの実機起動](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)、
[Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device/)、
[Expoのローカル開発](https://docs.expo.dev/guides/local-app-development/)。

## 実機の確認結果

agent-device / XCTestで端末画面を操作した。DBの直接監査や認証情報の検査は行わず、
アプリの通常の取得・保存・再起動後の再取得で照合した。

| 項目                    | 結果                                                                                                                 | 問題・修正 / 未確認事項                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Auth                    | 本人のログイン後、保存済みPlanを取得。複数回の完全再起動とバックグラウンド復帰でもログイン状態を保持                 | 長時間放置による認証期限切れ・通信断は未確認                                                                        |
| Settings                | Asia/Tokyo・08:00–23:00・最小20分を取得。25分へ保存し、最後は20分へ戻して再起動後も再取得                            | キーボード表示中の保存タップ問題を最小修正。下記の回帰テストを追加                                                  |
| Calendar権限            | 初回のiOSフルアクセス要求を確認。一度拒否し、拒否表示と「OS設定を開く」を確認。OS設定のフルアクセス選択後に取得成功  | 拒否後はiPhoneのアプリ別設定で「カレンダー → フルアクセス」。OS設定への切替時に画面検証ツールの一時的な待機があった |
| 通常予定 / timezone     | 実機の通常予定3件を取得。Tokyoの12:30–13:00、15:00–16:30、18:00–21:15を固定予定として扱った                          | 元の予定内容は変更していない。端末timezoneそのものを切り替える試験は未実施                                          |
| 終日予定                | 標準Calendarで11月5日の`ALP iPhone QA all-day`を作成。アプリで5日に表示、4日・6日には表示されない                    | Simulatorでの終日予定の日付ずれ修正は実機でも有効。テスト予定は削除済み                                             |
| Calendar変更 / 前面復帰 | テスト予定の追加と削除が、アプリを前面に戻すだけで再取得・反映された                                                 | iCloud等の別端末からの遅延同期は未確認                                                                              |
| Free Time               | 通常予定から08:00–12:30、13:00–15:00、16:30–18:00、21:15–23:00を計算。終日busy予定ありでは空き時間なし、削除後に復元 | Calendarタブは一日の枠、Plannerでは現在時刻以降に制限される                                                         |
| Planner / Preview       | RuleBasedのみ。現在時刻以降、Calendar非重複、slot内、各Taskの所要時間を満たす4件を生成                               | 600分Taskは連続枠不足で未配置。OpenAIは実行していない                                                               |
| Save / Today            | 承認後4 Actionを保存し、既存の同日Planを置換。TodayのTokyo基準11月5日、時刻とTask / Goalの対応を確認                 | daily_plans / planned_actionsのDB行をアプリ外から直接読んではいない                                                 |
| Complete / Skip         | テスト用CのAction・Taskは完了。AのActionはSkip、Taskは未完了のまま                                                   | 既存の通常Task 2件の状態は変更していない                                                                            |
| Activity Log            | 今回のC完了・Aスキップが追加され、既存3件と合わせて5件になった                                                       | 実機では表示と再取得を照合。snapshot全フィールドの再展開はせず、詳細照合はSimulator記録を参照                       |
| Replanning              | Todayから手動開始。完了Cを除外し、未完了Aを再配置。最新時刻で再生成して4→3件の置換保存に成功                         | taskId=null等の詳細ケースはSimulator確認を継承し、実機では再作成していない                                          |
| Stale Preview           | 確認中に古くなったPreviewの承認は拒否。最新時刻で再生成後に保存成功                                                  | Task変更単独のGuard試験は今回追加していない                                                                         |
| UI / ネットワーク       | safe area・ステータスバー・下部タブを実機画面で確認。Metro・Supabase通信が成功                                       | landscape、アクセシビリティ文字サイズ、多機種、回線切替・オフラインは未確認                                         |

## 保存・実行・再計画の照合

最初の保存は17:06開始以降。実機Calendarの15:00–16:30、18:00–21:15と重ならず、
次の検証用Taskが配置された。

| Task               | 保存したAction      | 実行結果                   |
| ------------------ | ------------------- | -------------------------- |
| iOS E2E A short    | 17:36–17:51（15分） | Action skipped、Task未完了 |
| iOS E2E C flexible | 21:45–22:35（50分） | Action / Task completed    |

通常Task 2件はそれぞれ30分で、17:06–17:36、21:15–21:45に配置された。
これらは実行・編集・削除せず、そのまま候補に含めた。

再計画の確認中にも時刻が進んだため、古いPreviewは拒否された。
明示的な再生成から続けて承認すると成功し、最終Planは次の3件になった。

- 通常Task: 17:14–17:44（30分）
- iOS E2E A short: 17:44–17:59（15分）
- 通常Task: 21:15–21:45（30分）

Cは除外され、Aはscheduledへ戻った。600分のDは引き続き未配置。
Activity Logには17:07のC完了・Aスキップと、13:19 / 13:20の既存3件が残る。
最終再起動後にも同じPlan・5件の履歴を取得して照合した。

## キーボード保存の修正と回帰テスト

再現条件: 実機Settingsの最小空き時間をソフトキーボードで編集し、キーボード表示中に
「変更を保存」を一度タップする。修正前はキーボードだけが閉じ、成功表示も保存も行われず、
二度目のタップで保存された。再起動すると最初の操作では元の20分のままであることを確認した。

原因は共有AppScreenのScrollViewが既定のタップ処理を使っていること。
`keyboardShouldPersistTaps="handled"`を指定し、ボタンが処理するタップを届ける1行の修正とした。
保存ロジック、repository、DB、native依存、画面構成は変更していない。

`e2e/ios/settings-keyboard-save.ad`に実際のネイティブUIを使う回帰テストを追加した。
前提はログイン済み、Settings画面の先頭、保存済み最小空き時間20分、ソフトキーボードが使える状態。
20→25分の入力後に保存を1回だけ押して成功を待ち、25→20分も同じ操作で戻す。
キーボードの表示自体も待つため、ハードウェアキーボードだけの状態を成功扱いにしない。

```sh
npx --yes agent-device@0.21.36 replay e2e/ios/settings-keyboard-save.ad \
  --session <実機を開いているsession名>
```

UI検証ツールはアプリの依存へ追加していない。先に同じagent-device環境・sessionで実機の
AI Life Plannerを開いておく。テストが中断した場合は、最小空き時間を20分へ戻して保存する。

- 修正前コードを完全再起動: step 6の保存成功待ちで失敗し、不具合を検出した。
- 修正後コードを完全再起動: 全11 steps成功（13.5秒）。最後に再起動し、保存値20分を再取得した。
- Simulator: Settings入力・保存は成功。今回はソフトキーボードが表示されない状態だったため、キーボード表示中の回帰判定は実機の結果を用いた。

Fast Refreshだけでは比較中のUI状態が残ることがあったため、修正前後の判定は完全再起動で行った。
Jestでnativeのタップ処理を模倣するprop比較テストは追加していない。

## 開発ツール固有の対応

実機画面検証には署名済みのXCTest runnerを使用した。MacのDevToolsSecurityが無効だったため、
本人が`sudo /usr/sbin/DevToolsSecurity -enable`で有効化した。
これは画面検証ツールの前提であり、通常のアプリ実機起動に追加で必要なiPhone設定ではない。

Expoのフローティング開発ボタンがアプリのSettingsボタンと重なっていた。
開発メニューを下へスクロールし、「Tools button」をオフにする端末内の設定で解消した。
アプリ本来のSettingsボタンで開閉できることも再確認した。アプリコードの回避策は加えていない。

## 終了状態と範囲

Settingsは元のAsia/Tokyo・08:00–23:00・最小20分。今回作成したCalendarテスト予定は削除済み。
以前の検証用Goal / Taskを再利用し、Aは未完了、B/Cは完了、Dは未完了で残す。
同日のPlanは実機Calendarを使った再計画後の3 Action、Activity Logは5件を確認用に残す。

Core v1の実機スモーク確認は、同一LANのMetroへ接続するdevelopment buildの範囲で完了と判断する。
長期の毎日利用、署名更新、Mac不在での起動、バックグラウンド長時間放置、通信断や日付跨ぎ、
別端末からのCalendar同期遅延まで確認済みという意味ではない。

次の候補はWeb Demo、UI・UX polish、README・公開用screenshots、GitHub公開準備。
公開用screenshotsには今回の実端末の個人予定・アカウント情報を使わず、ダミーデータを用意する。

品質チェックは`npm run typecheck`、`npm run lint`、`npm run format`、
`npm run format:check`、`npm run test:ci`（51 suites / 482 tests）、
`git diff --check`がすべて成功した。実機のネイティブ回帰テストは別途全11 steps成功。
