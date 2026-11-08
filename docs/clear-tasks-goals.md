# Tasks・GoalsのClear UI（Step 9C-2）

B案Clearの主色・セマンティック色、本文16、画面見出し28、余白16、カード角丸12を利用する。
一覧は共通Card / Badge、操作はActionButton / ItemActions、エラーはNoticeを使用する。

## 一覧と操作

- Tasks: タイトル → 所要時間・期限 → 状態・優先度 → 関連Goal → 編集/その他。
  Goal未設定のタスクはGoal行を省き、少ない情報をコンパクトに表示する。フォームでは引き続き「Goalなし」。
  PCでは補助情報と操作を横に整列し、小画面や文字拡大時は折り返す。
  完了はsuccess、予定済みはinfo、スキップはwarning、未予定はneutralの文字付きバッジ。
- Goals: タイトル → 現在値/目標値・単位と割合 → バー → 期限 → 状態/優先度 → 説明 → 操作。
  既存presentationの進捗式と丸め・上限をそのまま利用する。未設定時は割合・バーを出さず「進捗 未設定」。
  バーは数値・単位を含む読み上げ情報を持つ。長い説明（80文字超または3行以上）は2行プレビューから全文展開できる。
- 追加は画面見出し横に配置し、冗長な導入文を削減。読み込み中・空・通信/保存エラーは従来の状態表示を維持する。
- 編集は常設。削除は「その他」のインライン展開に分離し、その後に従来の確認ダイアログを出す。
  popup/menuの独自キーボードモデルを追加せず、Tab・Enterで使える通常のボタンと展開状態を使う。
  削除中はbusy表示と既存の全体mutationガードで編集・追加・多重削除を防ぐ。キャンセルではRepositoryを呼ばない。
- フィルターは従来の3条件・順序・ラベルを維持。44以上の領域・折り返し・focus輪郭を追加。
  Nativeはselected状態、Webはボタンに適したaria-pressedも渡す。

共通ActionButtonは展開状態を任意に受け取る。NativeのaccessibilityStateに加え、
React Native Webにはaria-expanded / aria-busyを明示する。進捗の数値も両プラットフォームへ渡す。

## フォームと保護する仕様

ModalFrame / FormField / FormInput / OptionGroup / Noticeを継続使用する。
変更は値入力行の折り返しと最小幅のみ。入力項目・validation・保存値・Repository呼び出しは維持する。
本文スクロール、保存footer、Safe Area、キーボード回避、WebのTab循環/Escape/focus復帰は共通部品の機能を使う。

DB・認証/RLS・Repository契約・Goal関連付け・フィルター条件・一覧の順序・進捗計算・Planner/Today・
DemoRepositoryのデータや初期化を変更しない。依存ライブラリは追加しない。

## 検証方法と限界

- 全Jest、typecheck、lint、format、diff、Web export/verifyを実行する。
- Webは375 / 390 / 768 / 1440pxで一覧・フォームを確認する。
  機能画面/フォームの文字と行高を200%相当に拡大し、横はみ出し、編集・削除・フィルター、
  フォーカス復帰とEnter/Tab/Escapeを確認する。既存タブバーの拡大は今回の対象外。
- Before/Afterは同じDemo UIから作成した長いタイトル・状態混在・未設定/完了/進捗ありのデータを使う。
  空・通信/保存エラー・削除中は一時的なメモリRepositoryの障害注入で撮影する。
  比較は375/1440の通常/200%、通常表示・フォームは390/768も記録する。
  ブラウザ標準confirmは確認文をJSONに記録し、Native確認ダイアログはSimulator画像に保存する。
- iOS Simulator 375ptで編集保存・ソフトウェアキーボード・削除キャンセル/確定、
  約214%のDynamic TypeでGoals/Tasksのスクロール・フォーム保存・その他/削除への到達を確認する。
  本番接続のない一時QA画面を利用し、ルートファイル・Simulator文字サイズを復元する。

実機ではVoiceOverの読み上げ順、長いタイトル・単位・説明、文字拡大、Safe Area、
キーボード表示中の保存、削除キャンセル、WebでのTab復帰を確認する。
実端末・実SupabaseでのCRUD検証とWeb本番公開は今回実施しない。

Step 9C-3（Settings/Auth）では共通のフォーム/Notice/focus規約を維持する。
Tasks/Goals専用のカード階層や「その他」を一律に移植する必要はない。
既存タブバーの200%問題は別のナビゲーション改善へ引き継ぐ。
