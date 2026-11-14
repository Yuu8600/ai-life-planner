# GitHubでのV1保全とV2公開

## 今回行うV1のGitHub保全

GitHub上で `origin` が意図した保存先であることを確認する。すでに公開されているこのリポジトリの `main` と今回のV1は同じコミットを指している。履歴には公開済みの個人メールが残っている。履歴を他の公開先へ移す場合は [Git履歴のプライバシー整理手順](../history-privacy.md) を参照する。

リポジトリのターミナルで次を実行する。

```sh
git push --atomic origin refs/heads/v1-stable:refs/heads/v1-stable refs/tags/v1.0.0:refs/tags/v1.0.0
git ls-remote origin 'refs/heads/v1-stable' 'refs/tags/v1.0.0^{}'
```

確認結果は下の2行。この2行は2026-11-14に利用者のコマンド出力で確認済み。GitHub Releaseを作る場合は別途GitHubの Releases → Draft a new release で既存タグ `v1.0.0` を選ぶ。V2着手に必要なのはGitHub上のブランチとタグの確認まで。

```text
45cee67db8f8b8c08f09c3f85ab66048fd2f209a  refs/heads/v1-stable
45cee67db8f8b8c08f09c3f85ab66048fd2f209a  refs/tags/v1.0.0^{}
```

V1のGit保存対象はソースと履歴。iPhoneのアプリ、Supabaseのデータ、Edge FunctionとSecretsはそれぞれの環境で管理する。既存のiOS導入手順は [iPhoneへのRelease版インストール](../ios-personal-release.md) を参照する。

## V2の公開順序

### 1. V2のPRを作成する

```sh
git switch feat/v2-redesign
git push -u origin feat/v2-redesign
```

GitHubで `feat/v2-redesign` → `main` のPRを作成し、CIと差分を確認する。実機テストは [MANUAL_TEST_CHECKLIST.md](MANUAL_TEST_CHECKLIST.md) を使う。テストと後述の本番適用計画を確認してからマージする。V1のソースは固定済みブランチ・タグから取得できる。

### 2. テスト用Supabaseで先に確認する

本番と分離したSupabase開発プロジェクトで、次のコマンドを順に実行する。`V2_PROJECT_REF` にはDashboardの対象プロジェクトのProject Refを指定する。現在のリンク先を変更するので、V1開発用のリンクを残す場合は別のローカルチェックアウトを使う。

```sh
export V2_PROJECT_REF='テスト用のProject Ref'
npx supabase login
npx supabase link --project-ref "$V2_PROJECT_REF"
npx supabase migration list --linked
npx supabase db push --dry-run --linked
npx supabase db push --linked
npx supabase functions deploy v2-chat --project-ref "$V2_PROJECT_REF"
```

新しいDBにはV1からV2までのmigrationが並ぶ。すでにV1スキーマ適用済みなら、適用予定を `20261114090000_v2_planner.sql` と `20261114100000_v2_chat.sql` に照合する。予期しないmigrationが出たら適用先と履歴を確認する。V1用 `planner-generate` のdeployやSecrets変更は不要。 [Supabase CLIリファレンス](https://supabase.com/docs/reference/cli/introduction)

開発ビルドの `.env` にテスト用の `EXPO_PUBLIC_SUPABASE_URL` と `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` を指定する。テストアカウントでGoals・Tasks・カレンダー・作業枠を確認する。別アカウントでもデータが分離されることを確認する。

### 3. AIを使う場合だけSecretsを設定する

Supabase Dashboardで対象プロジェクトの **Edge Functions → Secrets** を開き、以下を登録する。CLIを使う場合は値をリポジトリ外の非公開envファイルに入れ、`npx supabase secrets set --project-ref "$V2_PROJECT_REF" --env-file /path/to/private-v2.env` を実行する。APIキーは `.env` や `EXPO_PUBLIC_` 変数に入れない。

| Secret                             | 設定値                                                   |
| ---------------------------------- | -------------------------------------------------------- |
| `V2_OPENAI_API_KEY`                | V2用OpenAI APIプロジェクトのキー                         |
| `V2_OPENAI_MODEL`                  | Responses APIとJSON object出力に対応する低コストモデルID |
| `V2_OPENAI_INPUT_USD_PER_MILLION`  | 選択したモデルの入力100万トークン単価（USD）             |
| `V2_OPENAI_OUTPUT_USD_PER_MILLION` | 選択したモデルの出力100万トークン単価（USD）             |

単価は [OpenAI API価格表](https://platform.openai.com/docs/pricing) と照合する。OpenAI Platformの組織・プロジェクトの **Limits** で予算・通知閾値を確認する。プロジェクト予算の通知はAPIを停止しない。前払いの組織は **Billing** で自動リチャージの状態、閾値、月間リチャージ限度も確認する。アプリ内の月額$0.50はUTC月単位の推定制限。 [プロジェクト管理](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform) · [前払い請求と自動リチャージ](https://help.openai.com/en/articles/8264644-setting-up-and-managing-prepaid-api-billing)

### 4. 共有本番へ適用する場合

1. Supabase Dashboardで現在のバックアップと復元方法を確認する。V1とV2が同じGoal・Task・設定を使う前提を確認する。
2. テスト環境の同じDBでV1のログイン、Task更新、Plan保存、枠状態変更、V2側の計画維持を確認する。併用を検証できない場合はV2を別Supabaseプロジェクトに向ける。
3. テストが通ったら手順2の `V2_PROJECT_REF` を本番のProject Refに替え、dry-runの対象とmigration名を再確認してから適用する。必要時のみ手順3のV2 Secretsを登録する。
4. PRをマージし、必要な端末へV2をインストールする。V1とV2の両方でログインと読み取りを確認する。DBに問題があればV2の配布を止め、V1用の列・関数・計画明細には手を加えず影響を調査する。

同じiPhoneにV1とV2を並べる場合は、アプリを上書きする前に別bundle identifierと署名を準備する。ソースタグから再ビルドする手順は [iOS実機Release導入](../ios-personal-release.md)。
