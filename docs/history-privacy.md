# Git履歴のプライバシー整理手順

方針決定: 2026-11-06（Asia/Tokyo）。**個人メールの非公開を優先する。**
この文書は実行前の手順書であり、履歴整理の完了記録ではない。
既存履歴のrewrite、remoteへのpush、repositoryの作成・rename・Public化は行っていない。

## 対象と現在地

- 過去commitのAuthor / Committerにある作者本人の個人メール。
- 旧iPhone検証記録に含まれる個人環境の絶対path。
- 新しいcommitは確認済みのnoreply identityを使う。このrepositoryのローカル設定も変更済み。
- 今後の設定だけでは過去の生のcommit objectは変わらない。.mailmapを追加するだけでも除去にはならない。
- 実secretは監査で検出しておらず、今回はcredential rotationを目的とした作業ではない。

## 公開先の選択

| 方法                                             | 保持できるもの                                         | 確認点                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **整理した履歴を新しいrepositoryへ移す（推奨）** | ローカルで匿名化した開発履歴、現在のコード・画像・docs | 元repositoryをprivateのまま保持でき、旧PR参照を公開先へ持ち込まない。新repositoryの作成は別途承認後    |
| 既存repositoryの履歴を置き換える                 | 既存のrepository identityと、匿名化した開発履歴        | 全branch / tag、旧PR・cached view・他cloneへの対応が必要。branchだけの置換で完全除去したとは判断しない |

推奨は今回のプライバシー要件に対する判断であり、移行操作の承認を意味しない。
同じrepository名・Pages URLを使いたい場合は、元private repositoryのrenameと新規作成の影響も先に確認する。
rename後に同名の新repositoryを作る場合、旧cloneのoriginが新しい公開先を指してしまわないよう、
旧cloneのremote設定を元private repositoryの新しい名前へ合わせてから作業を進める。
履歴を残す必要がなければ、監査済みの現在のファイルだけから新しい初回commitを作る方法もある。

## 1. 再混入を防ぐ

GitHubの個人設定 **Settings → Emails** で次を設定する。

- Keep my email addresses private
- Block command line pushes that expose my email

このrepositoryには既に以下をローカル設定した。global設定は変更していない。

```sh
git config --local user.name Yuu8600
git config --local user.email 207811593+Yuu8600@users.noreply.github.com
```

GitHub UIでのmergeや別端末のGit設定も対象。ここだけ直しても、他のcloneから古い履歴・個人メールが再び入る可能性がある。

## 2. 対象を固定し、private backupと検証cloneを用意する

以下は**履歴整理の実行を依頼した後に使う手順**。現在の作業checkoutでfilter-repoを実行しない。
先に未commit変更・他の作業者・公開予定branch / tag・未反映のremote更新を確認し、作業中のpushを止める。
公開元のtreeは本書を含むdocs/portfolio-releaseの最新tipを採用する。既存mainだけを公開元にすると、
未mergeのREADME・画像・手順書が欠けるため、公開用mainへ最新の準備内容を含めることを確認する。

```sh
git status --short --branch
git for-each-ref --format='%(refname)' refs/heads refs/remotes refs/tags
git rev-parse HEAD

umask 077
source_repo=$(git rev-parse --show-toplevel)
privacy_root=$(mktemp -d)
git bundle create "$privacy_root/before.bundle" --all
git bundle verify "$privacy_root/before.bundle"
git clone --mirror --no-local "$source_repo" "$privacy_root/review.git"
```

`before.bundle`は個人情報を含むprivate backup。**remote変更前に一時領域から永続的な非公開領域へ保管**する。
元checkoutと元private repositoryも検証が済むまで保持する。bundleには未commitファイル・ignoredな.env・Signing設定は入らない。
必要なローカル設定は別途非公開で保管し、公開用Gitへコピーしない。

検証cloneは元データをhard linkで共有しない。ローカルcloneにはGitHubのPR参照・remote上だけの未取得branch等が
揃っていない場合があるため、公開先を決めた時点でremoteの全対象refs・PR・tagと照合する。

## 3. 非公開の置換表をレビューする

実メール・元の絶対pathを、repository・この手順書・commit message・公開logへ書き込まない。
実行担当者が検証cloneの生のmetadataを確認し、**作者本人の確認済みidentityだけ**を置換表へ入れる。
GitHub botや第三者のcopyright / メールをまとめて置換しない。

private作業領域に次の2ファイルを作る。以下の大文字表記は形式の説明で、実行前にprivate領域だけで実値へ置き換える。

`identities.mailmap`:

```text
Yuu8600 <207811593+Yuu8600@users.noreply.github.com> <OLD_OWNER_EMAIL>
```

`text-replacements.txt`:

```text
literal:OLD_PRIVATE_ABSOLUTE_PROJECT_PATH==>ai-life-planner
```

複数の旧メール・pathがあれば全て列挙し、未置換の説明用文字列を残したまま実行しない。
履歴の本文・commit / tag messageにも実メールがあれば、テキスト置換表へ対応するliteral置換を追加する。
置換表とscan reportはprivate作業領域だけに置き、Gitへ追加しない。

## 4. 検証cloneだけをfilterする

実行時に公式のgit-filter-repoを用意し、使用versionと入力表を記録する。今回toolのインストール・実行はしていない。
既存checkoutに対する`--force`でfresh-clone保護を回避しない。

```sh
cd "$privacy_root/review.git"
git filter-repo \
  --mailmap "$privacy_root/identities.mailmap" \
  --replace-text "$privacy_root/text-replacements.txt" \
  --replace-message "$privacy_root/text-replacements.txt"
```

mailmapはAuthor / Committer / Taggerのmetadataを変更し、replace-textは本文、replace-messageはcommit / tag messageを対象とする。
hash・署名・merge構造・古いhashへのリンクが変わり得る。filter-repoのcommit-map / changed-refsを確認し、
予期しないコード変更や第三者identity変更があればこの検証cloneを採用しない。

## 5. 公開可能な状態を検証する

公開予定のrefを明示した一覧を作り、以下を満たすまで公開しない。

- 全対象refから到達するcommit / tagの**生のobject**を検査し、旧メール・pathがmetadata・messageに残っていない。
  表示だけを変えるmailmap越しのgit logだけで判定しない。
- 全対象refの履歴のblobと、現在の公開ファイルをscanし、旧値と実secretがない。出力は値を伏せた件数・場所だけにする。
- 現在のtreeが元の公開準備済みtreeと一致する。許可したprivacy置換以外の差分がない。
- docsの「未実施」等の監査記録と古いcommit hashの記載を実行結果に合わせ、過去hashのリンク切れを確認する。
- 整理済みの公開用branchだけから新しいcheckoutを作り、typecheck・lint・format・Jest・Pages export・verify:pagesを実行する。
- 旧refs、backup、replace refs、remote-tracking refs、private置換表を公開対象へ含めない。公開用refへ旧commitがmergeされていない。

最新treeに差分がなくても履歴のprivacy検査は省略しない。scan結果と公開予定ref一覧をレビュー可能な形で残す。

## 6. remote操作の前で確認する

ここまでの結果を提示してから、**公開先・公開予定ref・remote操作の範囲**を確認する。
手順書の用意だけを、repository作成・rename・force-push・Public化の許可として扱わない。

新しい公開先を使う場合は、整理済みmainと必要なtagだけを空のprivate repositoryへ送り、
remoteから新しくcloneして同じ検査を行ってからPublic化を判断する。backupを含むmirror全体は送らない。
既存repositoryを使う場合は、全公開予定branch / tagの更新と不要refsの扱い、PR参照・cached view・他cloneを別途確認する。
旧PRへ残るcommitはbranchの更新だけで消えるとは限らず、GitHub Supportによる除去も非secretのメールでは保証されない。

## 7. 履歴整理後の公開

1. GitHub上の公開対象・PR・branch / tagを再確認する。
2. CI成功、README / LICENSE / 画像を確認してrepositoryをPublicにする。
3. PagesのSourceをGitHub Actionsへ設定し、Web Demo Pagesをmainで手動実行する。
4. 公開URLでasset・直接URL・reload・主要フローを確認し、READMEとAbout Websiteへ実URLを掲載する。
5. 元の個人情報入りcloneから公開先へpushしない。日常開発も整理後の新しいcloneから再開し、そのcloneに手順1のnoreplyローカル設定を再適用する。

現時点は**手順準備・再混入防止の設定まで完了、履歴整理自体は未実施**。Public化・Pages公開は保留する。

参照: [GitHubのメール設定](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)、
[GitHubの履歴除去と残存参照の説明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)、
[git-filter-repo公式manual](https://github.com/newren/git-filter-repo#how-do-i-use-it)。
