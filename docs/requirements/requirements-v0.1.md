# AI Life Planner — 要件定義書 v0.1

作成日: 2026-09-11  
最終更新日: 2026-09-17\
状態: Draft / MVP Definition  
仮称: AI Life Planner

---

## 1. プロダクト概要

### 1.1 コンセプト
ユーザーの「目標」「スマートフォンのカレンダー」「Todo」「過去の実行実績」をAIがまとめて理解し、
利用可能な時間に合わせて「今日いつ何をするか」を計画・再計画する日本語対応モバイルアプリ。

将来的には食事・運動・睡眠も同じ時間軸で管理し、生活全体を横断して提案する。

### 1.2 一般的なAIチャットとの差
一般的なAIチャットでは、ユーザーが毎回予定・目標・進捗などを説明して質問する必要がある。

本アプリでは、それらを構造化データとして保持し、

1. 状況を自動取得する
2. 選択されたPlannerProviderが計画を提案する
3. 提案を実際の予定として扱う
4. 実行結果を記録する
5. 未実行や予定変更に応じて再計画する

というループをアプリ内で完結させる。

---

## 2. 解決したい課題

現在、以下の情報は別々のアプリ・AIチャットで管理されることが多い。

- カレンダー
- Todo
- 学習目標
- 運動
- 食事
- 睡眠
- 実行実績

その結果、各サービスがユーザーの「同じ時間」を独立して使おうとし、
現実的には同時に実行できない計画が作られる可能性がある。

本アプリでは、すべての活動を「1日の有限な時間」という共通制約上で扱う。

---

## 3. 最終ビジョン

Goal
  ↓
AI Life Planner
  ├ Calendar
  ├ Todo / 学習
  ├ 食事
  ├ 運動
  ├ 睡眠
  └ 実績
  ↓
今日の行動計画
  ↓
実行
  ↓
記録
  ↓
翌日・当日の再計画

---

# 4. MVP v0.1

## 4.1 v0.1の目的

最初のバージョンでは以下のみを完成させる。

**Goal + Todo + Device Calendar + Provider-neutral Daily Planner + Replanning**

食事・運動・睡眠はまだ本格実装しない。

Daily Plannerは共通のPlanner ContractとPlannerProvider interfaceを使用する。
GitHub公開版を含むCore Appでは、RuleBased Plannerなど外部AI APIを必要としないProviderで
計画を生成できることを必須とする。

OpenAIによる計画生成は任意機能とし、利用する場合のみSupabase Edge Functionから
OpenAI APIを呼び出す。OpenAI API keyが未設定でも、Core Appの起動、Goal・Todo・Calendar、
空き時間算出、Daily Plan生成が動作しなければならない。

---

## 4.2 MVPに含める機能

### F01. 目標管理
ユーザーは目標を登録できる。

例:
- TOEIC 730点
- 期限: 2026-10-25
- 現在値: 530点
- 優先度: 高

最低限保持する項目:
- title
- description
- target
- current_value
- deadline
- priority
- status

### F02. Todo管理
目標に紐づいたTodoを登録できる。

例:
- 金フレ 20分
- Listening 30分
- Part 5 30分

項目:
- title
- goal_id
- estimated_minutes
- deadline
- priority
- status

status:
- pending
- scheduled
- completed
- skipped

### F03. スマートフォンのカレンダー取得
端末のカレンダーへのアクセス許可を取得し、指定期間の予定を読み込む。

最低限使用する情報:
- title
- start
- end
- all_day

MVPではイベント本文や参加者情報などは原則PlannerProviderへ渡さない。

### F04. 空き時間算出
既存カレンダー予定から、ユーザーが行動可能な空き時間を算出する。

ユーザー設定:
- planning_start_time
- planning_end_time
- minimum_slot_minutes

### F05. PlannerによるDaily Plan生成
選択されたPlannerProviderは以下をPlanner Contractに従った入力として受け取る。

- 日付
- Goals
- 未完了Todos
- Calendar events
- 空き時間
- 直近の実行実績
- ユーザー設定

配置可能時間の正は空き時間とし、Calendar eventsは計画理由や要約のための文脈情報として扱う。
ProviderがCalendar eventのbusy / free判定を再実装してはならない。

出力はProviderの種類にかかわらず自由文ではなく構造化データとし、共通Validatorで検証する。
入力されたTodoは、原則としてActionまたは理由付きのunscheduledのどちらか一方に含める。
Taskに紐づかない休憩・食事・運動などのActionは、`taskId: null` として表現できる。

例:

```json
{
  "date": "2026-09-11",
  "summary": "大学後の空き時間を利用してTOEIC学習を進めます。",
  "actions": [
    {
      "taskId": "11111111-1111-4111-8111-111111111111",
      "title": "TOEIC Listening",
      "startAt": "2026-09-11T17:00:00+09:00",
      "endAt": "2026-09-11T17:30:00+09:00",
      "reason": "期限が近く、今週の進捗が不足しているため"
    }
  ],
  "unscheduled": []
}
```

### F06. Today画面
今日の固定予定とPlanner提案予定を1つのタイムライン上に表示する。

区別:
- Calendar Event
- Planner Planned Action

### F07. 実行記録
Planner Planned Actionに対して以下を記録できる。

- 完了
- 未完了
- スキップ

将来的にはactual_minutesも追加する。

### F08. AIチャット
ユーザーは日本語でAIに相談できる。

例:
- 「今日は疲れたからこの勉強を短くしたい」
- 「17時から予定が入った」
- 「これ明日に回して」
- 「今日何を優先すればいい？」

AIは説明だけで終わらず、必要に応じて計画変更案を返す。

### F09. 再計画
以下のケースで未完了タスクを再配置できる。

- Todoを完了できなかった
- ユーザーが延期を依頼した
- 新しい予定と衝突した
- ユーザーが計画の変更を依頼した

MVPでは、Plannerが変更案を生成し、ユーザー承認後に反映する。

---

# 5. MVPに含めないもの

以下はv0.1では実装しない。

- 食事のカロリー計算
- レシピ提案
- HealthKit / Health Connect
- 睡眠自動取得
- GPS常時取得
- 店舗推薦
- Apple Watch対応
- SNS
- 他ユーザーとの共有
- 完全自動でのカレンダー書き換え
- 高度な機械学習による行動予測

---

# 6. 画面構成

## S01. Today
最重要画面。

表示:
- 今日の日付
- 今日の要約
- Calendar Event
- Planner Planned Action
- 完了ボタン
- スキップ
- 再計画
- AIへ相談

## S02. Goals
- 目標一覧
- 進捗
- 期限
- 優先度
- Goal作成 / 編集

## S03. Tasks
- Todo一覧
- Goalによる絞り込み
- estimated time
- deadline
- status

## S04. Calendar
- 端末カレンダー予定
- Planner予定
- 日 / 週表示は将来拡張

## S05. AI Chat
- 日本語チャット
- Plannerが参照している現在状況を利用
- 計画変更案
- 「適用」「キャンセル」

## S06. Settings
- 活動可能時間
- 最小空き時間
- カレンダー権限
- Planner Provider / Optional AI設定

---

# 7. Plannerの基本ルール

すべてのPlannerProviderは必ず以下を守り、Provider出力は共通Validatorで検証する。

1. Calendar Eventと重複する予定を配置しない
2. Todoのestimated_minutesを原則満たす
3. deadlineが近いTodoを考慮する
4. Goal priorityを考慮する
5. 1日の活動可能時間外には配置しない
6. 同じ時間に複数Actionを配置しない
7. 出力はSchemaに従った構造化データにする
8. 不可能な場合は無理に配置せずunscheduledとして返す
9. Plannerが勝手に端末の固定予定を削除しない
10. 計画変更はMVPでは原則ユーザー確認後に適用する

---

# 8. 推奨技術構成

## Mobile
- React Native
- Expo
- TypeScript
- Expo Router

## Device Calendar
- expo-calendar

MVPではGoogle Calendar APIを直接使用せず、
スマートフォンのシステムカレンダーを読む方式を優先する。

## Backend
- Supabase
  - PostgreSQL
  - Auth
  - Edge Functions
  - Row Level Security

## Planner
- Provider-neutralなPlanner Contract
- Core / GitHub公開版ではRuleBased PlannerなどAPI不要のProviderを使用可能
- すべてのProviderで構造化されたPlanner Outputと共通Validatorを使用

## Optional AI
- Supabase Edge Function経由のOpenAI API
- OpenAI API keyはSupabase Secretとして管理
- API keyをモバイルアプリへ直接埋め込まない
- OpenAI未設定時もCore AppとPlannerを利用可能

## Repository
- GitHub

---

# 9. データモデル v0.1

## profiles
- id
- display_name
- timezone
- planning_start_time
- planning_end_time
- created_at

## goals
- id
- user_id
- title
- description
- target
- current_value
- deadline
- priority
- status
- created_at
- updated_at

## tasks
- id
- user_id
- goal_id
- title
- estimated_minutes
- deadline
- priority
- status
- created_at
- updated_at

## daily_plans
- id
- user_id
- plan_date
- summary
- created_at
- updated_at

## planned_actions
- id
- daily_plan_id
- task_id
- title
- start_at
- end_at
- reason
- status

## activity_logs
- id
- user_id
- planned_action_id
- result
- actual_minutes
- created_at

---

# 10. MVPユーザーストーリー

### US01
ユーザーとして、長期目標を登録したい。
なぜなら、Plannerに何を優先すべきか判断してほしいから。

### US02
ユーザーとして、目標に関連するTodoを登録したい。
なぜなら、目標を具体的な行動へ分解したいから。

### US03
ユーザーとして、スマートフォンの既存予定をアプリに反映したい。
なぜなら、予定と重ならない計画を作ってほしいから。

### US04
ユーザーとして、「今日の計画を作成」を押したい。
なぜなら、自分で空き時間を探してTodoを割り当てる手間を減らしたいから。

### US05
ユーザーとして、Todoを完了・スキップしたい。
なぜなら、実績を翌日以降の計画へ反映したいから。

### US06
ユーザーとして、日本語で「これを明日に回して」とAIへ伝えたい。
なぜなら、画面を何度も操作せず自然言語で計画を変更したいから。

---

# 11. v0.1 Acceptance Criteria

以下をすべて満たしたらMVP完成とする。

- [ ] Goalを作成・編集・削除できる
- [ ] GoalにTodoを追加できる
- [ ] Todoに所要時間と期限を設定できる
- [ ] スマホカレンダーの読み取り権限を取得できる
- [ ] 今日の既存Calendar Eventを取得できる
- [ ] Calendar Eventと重複しない空き時間を計算できる
- [ ] 「今日の計画を作成」で選択されたPlannerProviderがPlanを生成する
- [ ] OpenAI API keyなしでCore AppとPlannerが動作する
- [ ] すべてのPlannerProvider出力をSchema / Domain Validationできる
- [ ] Today画面にCalendar EventとPlanner Actionを表示できる
- [ ] Planner Actionを完了できる
- [ ] Planner Actionをスキップできる
- [ ] AIチャットから予定変更を依頼できる
- [ ] 未完了Todoを別の空き時間へ再計画できる
- [ ] Plannerが固定Calendar Eventを勝手に削除しない
- [ ] 基本機能に自動テストがある
- [ ] READMEからセットアップ・実行方法が分かる

---

# 12. 開発順序

## Milestone 0 — Repository
1. GitHub Repository作成
2. Expo + TypeScript初期化
3. lint / formatter / test設定
4. AGENTS.md作成
5. README作成

## Milestone 1 — Static Prototype
1. Bottom navigation
2. Today UI
3. Goals UI
4. Tasks UI
5. AI Chat UI
6. ダミーデータで画面遷移

## Milestone 2 — Data
1. Supabase作成
2. DB migration
3. Auth
4. Goal CRUD
5. Task CRUD

## Milestone 3 — Calendar
1. Calendar permission
2. Event取得
3. 空き時間計算
4. Todayへ統合

## Milestone 4 — Planner
1. Provider-neutral Contract / Provider interface / Output validation
2. Planner input生成
3. API不要のRuleBased Planner
4. Preview / User confirmation
5. Daily Plan保存
6. Today表示
7. Optional: Supabase Edge Function経由のOpenAI Provider

## Milestone 5 — Replanning
1. Complete / Skip
2. AI Chatから変更要求
3. Replan
4. 変更Preview
5. Apply

## Milestone 6 — MVP Polish
1. Error handling
2. Loading / Empty State
3. Tests
4. README
5. Demo用データ
6. 実機テスト

---

# 13. v0.2以降

## v0.2
- 実績分析
- Planner改善
- 通知
- 自動再計画候補

## v0.3
- HealthKit / Health Connect
- 睡眠
- 運動
- 体重

## v0.4
- 食事記録
- 食事時間提案
- 栄養目標

## v0.5
- 位置情報
- 移動時間
- 場所に応じた行動 / 食事候補

## v1.0
Todo・食事・運動・睡眠を横断して計画するAI Life Planner。

---

# 14. 成果物として評価する指標

自分自身で一定期間使用し、以下を記録する。

- 1日の計画作成に必要な時間
- AIが提案したAction数
- Action完了率
- スキップ率
- 再計画回数
- AI提案を手動変更した割合
- Goalごとの進捗
- AI計画に対する主観評価
- 従来のAIチャット利用時との操作量比較

最終的には、
「AIチャットで毎回状況を説明して計画を相談する方法」と
「本アプリで構造化データを自動参照して計画する方法」を比較する。
