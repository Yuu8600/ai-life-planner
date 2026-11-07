# Calendar予定ごとの個別余白

Calendarの時間付きblocking予定の「余白を設定」から編集する。
共通設定と、この発生回だけの個別設定を選ぶ。前後それぞれ0〜240分の整数で、
個別設定がある場合は前後両方を使う。0分も明示的な上書きとして扱い、
「共通設定を使う」を保存すると個別レコードを削除する。
共通設定を変えても個別値は変わらず、保存済みPlanの反映には明示的な再計画が必要。
TodayとPreviewには編集操作を設けない。端末Calendarの予定そのものは一切変更しない。

## 発生回の照合と制約

キーはuser_id、calendar_id、event_id、occurrence_start_at（開始instant）。
開始instantはUTCへ正規化し、タイトル・instanceIdはキーや保存情報に使わない。
インストール済みexpo-calendar 57.0.6のiOS実装と既存normalizationが返すID・実際のstartAtを使う。
[Expo SDK 57 Calendar](https://docs.expo.dev/versions/v57.0.0/sdk/calendar/)では
instanceIdは永続性が保証されないため、シリーズ全体やinstanceIdだけへの照合は行わない。

同じシリーズでも開始時刻が違えば別の設定となる。予定の移動・編集・カレンダー移動・同期や
再インストール等でIDまたは開始instantが変わった場合は、自動追跡せず共通値へ戻す。
同じタイトルの別予定には引き継がない。端末間のID互換性も保証しない。
削除された予定の未使用設定は自動で別の予定へ付け替えず、DBに残る場合がある。
その未使用設定の最大値で余分な隣接日取得が起こる場合があるが、最大3日を維持する。

## 計算・保存の安全性

CalendarとPlannerは同じRepositoryから全個別設定を取得して適用する。
Supabaseはexact countと実際の取得行数でページングする。上限で切れた結果・count不明・
取得中の件数変化・重複・不正行は成功扱いにしない。取得失敗時は生成・承認を失敗させる。
同件数の同時編集を含む読み取りはトランザクションsnapshotではないため、
承認時に最新の設定・予定で再検証する。複数端末の同時編集を完全に直列化する設計ではない。

共通値と全個別設定の最大値から隣接日取得を判断し、共通0分でも必要な隣接日を取得する。
当日の表示には隣接日だけの予定を混ぜず、計算用イベントを重複排除する。
終日・free・canceledは対象外で、既存のblocking・merge・clamp・DSTの扱いは維持する。
生成・承認・再計画は同じ有効余白を利用し、Proposal・保存Actionに個別設定を混ぜない。
stale拒否時は既存Previewを保持し、明示的な再生成を必要とする。
保存済みTodayの操作は設定Repositoryに依存しない。

保存するのは照合用ID・発生回の開始instant・余白・監査timestampだけで、
タイトル・場所・説明・参加者等は保存しない。
新テーブルのRLSは各操作をauth.uid()の所有者に限定する。
public/anonの権限を剥奪し、authenticatedにSELECT/INSERT/UPDATE/DELETE、
service_roleに既存方針と同じ管理権限を明示付与する。プロフィール削除でcascadeする。

## 適用・更新順序

1. local commitをレビューしてユーザーがpush / PRする。
2. 対象Supabase projectと既存migrationの適用状態を確認してdry-runする。
   Step 4が未適用なら、そのmigrationと今回の
   `20261107110000_add_calendar_event_buffer_overrides.sql`の両方を含む順序を確認する。
3. ユーザーの判断でmigrationを適用し、共通設定・個別0分・保存解除・ユーザー分離を確認する。
   今回の型は全migration適用済みの隔離ローカルschemaから公式CLIで生成済み。
4. DB反映後にNativeを同じbundleIdentifierへ上書き更新し、権限・繰り返し予定・
   保存解除・Calendar/Planner・承認・再計画・既存Plan保持を実機確認する。
5. mainの手動Pages workflowでWeb Demoを公開する。Demoは外部DBを使わず、reloadで初期化する。

**DB反映前に新Native版を本番利用しない。** 未反映DBでは個別設定の読み取りが失敗する。
Codexからremote migration・Web公開・Native配布は行わない。
SQL検証は隔離ローカルDBだけで`supabase/tests/local/calendar_event_buffer_overrides.sql`を実行する。
