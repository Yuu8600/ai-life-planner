# 共通QAとiPhone向けクラウド

| 用途                         | 接続先                                           | データ                           |
| ---------------------------- | ------------------------------------------------ | -------------------------------- |
| 実装確認・Simulator QA       | 共通ローカルQA API `127.0.0.1:56821`、DB `56822` | 既存のQAアカウントとテストデータ |
| 旧版からの移行・破壊的テスト | 必要なときだけ別ID・別ポートの一時ローカル環境   | 作成したダミーデータ             |
| iPhone実機・日常利用         | 既存SupabaseクラウドのHTTPS接続先                | 日常データ。移行確定後に使用     |
| ポートフォリオ               | Web Demo                                         | ローカルのサンプルデータ         |

## 共通QAを使う

このMacの固定場所は `~/Library/Application Support/AI Life Planner/qa`。ディレクトリは本人だけがアクセスできる。旧V2.7 QAの Docker ID `ai-life-planner-v27-qa`、DBボリューム `supabase_db_ai-life-planner-v27-qa`、ポート、QAアカウントを維持した。元の一時ディレクトリは保管し、固定場所を起動元にする。旧V2/V2.5/V2.6は従来のIDで保持している。

リポジトリから実行する。QAの設定とポートを毎回検査し、状態表示に接続キーを出力しない。

```sh
npm run qa:start
npm run qa:status
npm run qa:backup
npm run qa:apply
npm run qa:restart
npm run qa:stop
```

- `qa:apply` はリポジトリのSQLを固定QAへコピーして、未適用分だけを `migration up --local` で適用する。Edgeソースも同期する。Edgeを更新した場合は再起動して確認する。破壊的なSQLは一時環境で先に検証する。
- `qa:stop` は共通QAだけを停止し、データのボリュームを保持する。`qa:restart` は保持したまま再起動する。
- `npm run supabase:types:local` は共通QAから型を生成する。生成後に差分と型チェックを確認する。
- ルートの `supabase/config.toml` は標準設定のまま。既定DBポート `54322` は別のローカルプロジェクトが利用しているため、通常QAには上記コマンドを使う。

## iOSビルド

| コマンド                                    | 対象                                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run ios:qa -- --check`                 | 56821のURLと公開用キーの組だけを確認                                                                                                   |
| `npm run ios:qa`                            | 起動中のiOS Simulatorを1台に絞って実行。QAアプリ `com.uyu.ailifeplanner.v27qa` を上書きし、既存のアプリデータを引き継ぐ                |
| `npm run ios:cloud -- --check`              | 固定設定のクラウド参照・公開用キー・CLIリンク・DBとEdgeの対応状況を確認                                                                |
| `npm run ios:cloud`（`ios:release` も同じ） | 対応済みクラウドだけを許可。接続されたiPhoneを1台に絞り、既存の `com.uyu.ailifeplanner` とXcode署名設定でReleaseをビルド・インストール |

共通QAの公開用キーは起動中のローカルCLIから取得する。クラウドは固定場所の `iphone-cloud.env`（権限 `600`）で、`ALP_CLOUD_PROJECT_REF`・公開用URL・公開用キーを一組で管理する。両ビルドはExpoのdotenv読み込みを無効にする。初回のXcode生成、署名、端末の信頼、Developer Modeなどは[実機ビルド手順](ios-personal-release.md)を参照。

Macを替えるときは、固定場所に `iphone-cloud.env` を用意し、既存プロジェクトの値を次の形式で1行ずつ設定する。保存先ディレクトリは権限 `700`、ファイルは `600` にする。実機ビルドの前に同じプロジェクトをCLIで参照できる状態にする。

```dotenv
ALP_CLOUD_PROJECT_REF=your-project-ref
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-key
```

## AI設定

固定場所の `qa-ai.env`（権限 `600`）を共通QAのEdgeが読み込む。変更後は `npm run qa:restart` で反映できる。通常の自動テストはモックを利用し、QAではキーが空のままでもTaskや推薦を確認できる。

`v2-chat` は `V2_OPENAI_API_KEY`、`V2_OPENAI_MODEL`、`V2_OPENAI_INPUT_USD_PER_MILLION`、`V2_OPENAI_OUTPUT_USD_PER_MILLION` を読む。単価はモデルと同じ入出力100万トークン当たりのUSD単価。クラウド側はSupabase Secretsで同じ名前を設定する。旧 `planner-generate` の `OPENAI_API_KEY` と `OPENAI_MODEL` は別契約。クライアントには公開用Supabaseキーだけを渡す。実APIの有料送信は利用者の承認後にQA用アカウントで行う。公開用のリポジトリにはテンプレートとテストデータだけを含める。

「AIの設定を再確認」は有料リクエストを送らずに設定と残予算を表示する。共通QAでは4項目が空で、有効な既存QAアカウントに対して `configured: false` を確認した。利用料の上限は1ユーザーにつきUTC月ごとに0.50 USD相当。

## DBのバックアップと復元

- 共通QAでは `npm run qa:backup` が固定場所の `backups/` に権限を絞ったPostgresカスタム形式の `qa.dump` とチェックサムを作る。初回移行直前のバックアップは `backups/initial/`。固定場所の設定・QAログイン・AI設定はDBアーカイブとは別なので、必要に応じて暗号化したMac内バックアップで保管する。

### ローカルでの復元確認

バックアップと同じマイグレーションを適用した専用のローカルSupabaseを、共通QAとは別ID・別ポートで起動する。以下は今回のリハーサルIDを使う例。対象コンテナのポートを確認してから実行する。

```sh
set -e
set -o pipefail
umask 077
backup_dir="$HOME/Library/Application Support/AI Life Planner/qa/backups/initial"
restore_db=supabase_db_ai-life-planner-v27-rehearsal
(cd "$backup_dir" && shasum -a 256 -c sha256.txt)
docker port "$restore_db" 5432/tcp   # 分離先の 56922 を確認
restore_list=$(mktemp)
docker exec -i "$restore_db" pg_restore --list < "$backup_dir/qa.dump" |
  awk '/TABLE DATA public / || /TABLE DATA auth (users|identities) /' > "$restore_list"
test -s "$restore_list"
docker cp "$restore_list" "$restore_db:/tmp/alp-restore.list"
rm "$restore_list"
(
  echo 'BEGIN;'
  docker exec -i "$restore_db" pg_restore --data-only --disable-triggers \
    --use-list=/tmp/alp-restore.list -f - < "$backup_dir/qa.dump" || exit 1
  echo 'SELECT count(*) FROM auth.users;'
  echo 'SELECT count(*) FROM public.tasks;'
  echo 'SELECT count(*) FROM public.v2_events;'
  echo 'ROLLBACK;'
) | docker exec -i "$restore_db" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1
```

この手順は件数の確認後にロールバックする。実際の復元は同じ構造の空の別環境で行い、永続化後に件数・参照関係・テストアカウントのログインを確認してから切り替える。対象はアプリのテーブルとAuthのユーザー・ID連携。セッションは引き継がず、利用者は再ログインする。稼働中の共通QAへ上書きしない。

### クラウド移行時のバックアップと復元

1. 移行直前に書き込みを止め、対象のプロジェクトを照合する。利用可能なダッシュボードのバックアップを確認する。論理バックアップを取る場合はGit管理外の暗号化した保存先に、ロール、スキーマ、データ、マイグレーション履歴を個別に保存する。
2. ダッシュボードまたは公式CLI手順で、Auth利用者とID連携を復元できることを確認する。Storageを利用している場合はオブジェクトも別途保全する。EdgeソースとSecretsは別で保管する。
3. 障害時は追加の書き込みを止め、別の検証先で公式手順に沿って復元し、件数、ログインとRLSを確認する。移行後に書き込まれたデータへの影響と復元先の切り替えを確認し、承認後に復旧を行う。

[Supabaseのバックアップ](https://supabase.com/docs/guides/platform/backups) · [CLIでバックアップと復元](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) · [Supabase Secrets](https://supabase.com/docs/guides/functions/secrets)

## クラウド移行前チェックリスト

1. クラウドの適用履歴、利用中の旧Nativeと日常アカウント、バックアップ対象を確認する。
2. 現在のクラウドと同じ最初の10件だけを入れた一時ローカル環境で、[リハーサル用SQL](../supabase/tests/rehearsal/) の `legacy_seed.sql`、`legacy_snapshot.sql` を実行する。残り8件をコピーして、対象の作業ディレクトリで `supabase migration up --local` を実行する。再度スナップショットを取得し、`cmp` で照合する。最後に `upgrade_checks.sql` と、完了・一括操作、AI承認、V2計画のローカルSQLを実行する。
3. 旧Nativeは所要時間がNULLのタスクを読み込めない。旧AIのGoal作成・`goalKey` 付きTaskの同時承認も現行RPCでは扱えないため、古いクライアントと新しいものを併用する期間を決める。設定済みのクラウドはV1の10件まで。当面 `ios:cloud` はガードで停止する。
4. 利用者の承認後、対象クラウドとバックアップを確認し、`db push --dry-run` で8件を照合する。**DB → `V2_OPENAI_*` → `v2-chat` 配備 → 実機ビルド** の順で進める。旧Secretsと `planner-generate` は保持する。
5. iPhoneで既存アプリIDと署名を確認し、専用のテストアカウントでログイン、Task、推薦、カレンダー、AIの状態表示を確認する。有料AI送信は別途了承後に行う。
6. 普段は実装・ローカルQA・Simulator、利用者によるpushとPR・CI、必要なクラウド変更の承認、実機確認の順。配備済みバックエンドの範囲内のUI変更なら、PR前にも実機で確認できる。

### 分離環境で回すSQL

移行元の最後のバージョンは `20261107130000`。残りは `20261114090000` から `20261123100000` までの8件。各SQLは `psql -v ON_ERROR_STOP=1` で実行し、エラー時は次に進まない。比較時は `legacy_snapshot.sql` を `psql -XAt` で実行してから `cmp` を取る。

- [リハーサル用SQL](../supabase/tests/rehearsal/)の `legacy_seed.sql` → `legacy_snapshot.sql` → 8件を適用 → `legacy_snapshot.sql` → `upgrade_checks.sql`
- [ローカルDBテスト](../supabase/tests/local/)の `v2_planner.sql`、`v25_recommendations.sql`、`v25_ai_action_drafts.sql`、`v25_undo_daily_result.sql`、`v26_ai_calendar.sql`、`v27_calendar_policy_approval.sql`、`v27_batch_task_actions.sql`

## 今回の検証結果

- 共通QAを固定場所から停止・再起動。同じDBボリュームで、Task 9件、アプリ内予定1件、プロフィールを再起動前後で照合した。Auth行の差は更新日時のみ。既存QAアカウントでログインし、`v2-chat` の状態を取得した。
- QAのDBアーカイブからアプリのテーブルとAuth利用者を分離DBへ読み込み、件数を検証してロールバックした。クラウドのバックアップ取得・復元は今回の範囲外。
- 分離環境で10件から18件へ更新。旧アカウント、Goal、Task、計画、作業枠、実行履歴の既存フィールドが一致した。所要時間NULLと正値制約、別ユーザーからの読み取り拒否、完了・実施・取り消し・一括操作、AI承認を含むSQL 8本に合格。実データのコピーは使用していない。
- 旧形式のAIを対象にした `supabase/tests/local/v2_chat.sql` は現行DBで `Unsupported draft item` を再現した。現行形式でのチャット、予算予約・確定、上限、利用者分離、承認後のTask保存は `upgrade_checks.sql` で確認した。移行元のクラウド10件にはAI下書きテーブルがまだ存在しない。
- Simulator向けReleaseのビルド、接続設定の埋め込み、上書きインストール、起動、上書き時のローカルデータ保持を確認した。別環境の環境変数を与えた場合も共通QAを使用した。現行クラウドを指定した場合はDB未対応で実機用ビルドが停止した。実機の署名・インストールと有料AI送信は未実施。
- 型チェック、lint、Prettierの変更ファイル検査、Jest 78スイート・761件に合格。
