# 翌日深夜までの活動時間

Settingsの活動終了時間に「当日／翌日」を追加した。
`planningEndDayOffset`は0または1。HH:mmの入力・既存の分単位値を維持し、15分への丸めは行わない。
活動期間はローカル時計上で0分より長く24時間以内。
例: 09:00〜翌日02:00、20:00〜翌日01:30。09:00〜翌日10:00は拒否する。
00:00は有効、24:00は無効。同時刻でも翌日終了なら24時間として扱う。

## 計画日と暦日

共通の`getPlanningDate`と`getPlanningWindow`をSettings・Planner・Today・Demoで利用する。
翌日終了では、現在のローカル時刻が終了時刻より前なら前日を計画日とする。
09:00〜翌日02:00の場合、00:30・01:59は前日Plan、02:00以降は新しいPlan。
開始時刻前でも前日の活動が終わっていれば新しい計画日になる。当日終了は従来どおり暦日。
日付の進行にはaddLocalDaysを使い、UTCの24時間加算でローカル日付を進めない。

Planning Windowの開始・終了はprofile timezoneのUTC instantへ変換し、正の区間かを検証する。
新しい活動時刻変換では、DSTの存在しない時刻・重複する時刻を明確に拒否する。
従来の汎用timezone utilityは変更せず、計画時刻だけにこの厳格な規則を適用する。
24時間上限は設定上の時計差なので、DST日は経過時間が23／25時間になり得る。
クライアントとDBは両方ともこの仕様を使う。

## Calendar・Planner・Today

Calendarタブは選択した暦日を表示し、Free Timeはその日から始まる活動区間を計算する。
Plannerは現在の計画日を基準にし、翌日深夜分を含むfreeSlotsを現在時刻以降へ切り詰める。
活動の翌日と余白用の隣接日を取得する。最大4暦日（計画日・翌日・余白用前日／翌々日）。
当日のCalendar一覧とは計算用データを区別し、発生回キーで重複を除く。
終日予定はexclusive end dateのローカル日付区間と活動区間の交差だけをブロックする。
共通余白・個別0分・blocking判定・最小空き時間・merge/clampは維持する。

Provider・Proposalの形式は変えず、dateの意味を計画日へ統一した。
生成・承認・再計画で最新の設定と予定を再検証し、計画日や活動区間が変わればstale拒否する。
保存済みPlanを設定変更で再配置しない。
Todayは計画日を表示し、保存区間内の翌日Actionも読み取り・完了／スキップできる。
Activity Logのplan dateは保存Planに従う。翌日分の時刻は「翌日 HH:mm」と表示する。
前面復帰時の再取得に加え、表示中も60秒ごとに再取得し、0時ではなく計画日の終了境界を反映する。
境界を跨いだ画面更新には最大約60秒の遅れがあり、アプリ復帰時は既存のfocus/foreground更新も使う。

Demoは従来のサンプル日を維持し、「時計を翌日01:00に進める」で深夜を試せる。
Auth・Supabase・OpenAI・端末Calendarへの接続は追加しない。reloadで初期化する。

## DBと既存データ

migration: `20261107130000_add_overnight_planning.sql`。
profilesに`planning_end_day_offset integer NOT NULL DEFAULT 0`と0/1制約を追加し、既存の時刻値を変更しない。
新しい期間CHECKはNOT VALIDで追加し、過去の不正な手動設定があっても行を書き換えない。
新規・更新時は期間制約を適用する。過去に不正な設定がある場合は、活動時間の修正が必要。
既存Plan・Task・Action・余白設定・履歴を削除しない。

daily_plansに`window_start_at`・`window_end_at`を追加する。
旧Planは当時の正確な活動時間を復元できないため、保存timezoneに基づく従来の暦日区間を引き継ぐ。
新しい保存ではその時点の活動区間を記録し、Todayは現在のprofile時刻ではなく保存区間でActionを読む。
これにより、設定変更後に保存済みActionを範囲外として落とすことを避ける。

replace_daily_planにwindow token付きのoverloadを追加し、DBでも現在の計画日・timezone・
最新profileから算出する活動区間・Action範囲を検証する。
旧4引数RPCは同じ認証／RLSのまま新しい処理を呼び、旧版呼び出しにも対応する。
新しいguarded overloadは既存のlock_replan_if_currentを同じ順序で呼び、snapshotと競合guardを維持する。
旧guarded RPCも残す。新旧RPCはsecurity invoker、公開helperは認証ユーザー／service_roleだけが実行可能。
DB型は最終migrationを適用した隔離ローカルDBから公式CLIで生成する。

## 適用・端末確認の順序

1. diff・migrationをレビューし、ユーザーがpush / PRする。
2. 対象Supabase projectと未適用migrationを確認し、ユーザー判断でdry-run後に適用する。
   Step 4／5が未適用なら先に必要となる。Codexからremote操作は行わない。
3. 新旧RPCの保存・深夜の計画日・window token拒否・別ユーザー隔離・再計画を確認する。
4. DB確認後に、ユーザー判断でiPhoneへ同じbundleIdentifierで上書き更新する。
   未反映DBへ新Native版を接続して本番利用しない。
5. 実機でSettings保存・再起動、23:59→00:00→終了境界、Calendar権限／復帰、
   翌日Actionの完了／スキップ・履歴・再計画・保存済みPlan保持を確認する。
   DST地域では存在しない／重複する活動時刻のエラーも確認する。
6. Web Demoはmainの既存手動Pages workflowで公開後、直接URL・reload・深夜時計を確認する。

CodexからWeb公開、iPhoneのbuild・配布・上書きは行わない。
検証SQLは`supabase/tests/local/overnight_planning.sql`を隔離ローカルDBだけで実行する。
