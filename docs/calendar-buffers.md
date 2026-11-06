# Calendar予定前後の余白

Settingsの「予定前の余白時間」「予定後の余白時間」で共通の余白を設定する。
時間・分を入力し、前後それぞれ0〜240分の整数として保存する。初期値は前後0分。

## 計算と取得

時間付きのblocking予定だけを、開始前・終了後へ実時間の分数で拡張する。
free・canceledは対象外。tentative・unknown等の既存のblocking判定は維持する。
終日予定のdate-only判定は従来どおりで、余白は加えない。
拡張した区間を活動時間内へclampし、接続・重複区間を統合した後に最小空き時間を判定する。
DSTの日もprofile timezoneの日付境界とUTC instantを使う。

Calendar Repositoryの日付filterを維持し、前後0分なら当日だけ取得する。
予定後の余白があれば前日、予定前の余白があれば翌日も取得する（最大3日）。
隣接日は時間付き予定だけを計算へ渡し、同一calendar・event・occurrence・区間の重複を除く。
隣接日の取得失敗時は不完全な空き時間を使わず、Calendarの空き時間表示／Planner生成を失敗させる。
当日の予定一覧とPreviewのCalendar参考情報には隣接日だけの予定を追加しない。
イベント自体の開始・終了時刻は変更しない。

Calendarの空き時間表示、Planner生成、保存承認時の再検証は同じ取得・計算経路を使う。
RuleBased・OpenAIとも余白適用済みfreeSlotsと既存Validatorに従う。
新設定で不正になったPreviewは承認時に拒否し、勝手に再配置しない。
保存済みPlanは設定変更だけでは変えず、反映には明示的な再計画を必要とする。
Web Demoはメモリ内の設定を使い、外部サービスへ接続しない。

## DB反映・公開・Native更新の順序

**このbranchのNative版を、DB反映前に本番利用しない。** 新列を読むため、未反映DBではSettingsやPlannerが失敗する。

1. migrationと差分をレビューしてpush / PRする（Codexは実行しない）。
2. 対象のSupabase projectと既存migrationの適用状況を確認し、ユーザーの判断で
   `npx supabase db push --dry-run`を実行する。既存の未適用migrationも含まれないか確認する。
3. ユーザーが`npm run supabase:db:push`で承認したmigrationを適用する。
   `20261107090000_add_calendar_event_buffers.sql`はprofilesに2つのinteger NOT NULL DEFAULT 0列と
   0〜240のCHECKを追加する。既存データは0分、RLS・table GRANTは維持する。
4. Settingsの既存値取得、前後0分、非0分の保存・再取得、別ユーザーの隔離を検証する。
   必要ならユーザー判断で`npm run supabase:types:linked`を行い、型を比較する。
   このbranchの型は全migration適用済みの隔離ローカルschemaから公式CLIで生成している。
5. mainへ取り込み後、Web Demoは既存の手動Pages workflowで公開する。DemoはDB反映に依存しない。
6. DB反映・確認後に`npm run ios:release`で同じbundleIdentifierへ上書き更新する。
   アプリは削除せず、Settings・Calendar・生成・承認・再計画・既存Plan保持を実機で確認する。

この作業ではlinked DBへのmigration適用・型取得、remote deploy、Pages公開、Native更新を行わない。
ローカルSQL検証は`supabase/tests/local/calendar_buffers.sql`を使い、fixtureはrollbackする。
