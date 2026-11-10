# Documentation

最初に[repository README](../README.md)で概要とDemoを確認してください。
以下は、現在の設計・開発手順と、実施時点の検証記録への入口です。

## Architecture

- [現在の構造・Coreとadapterの境界](architecture.md)
- [要件定義 v0.1](requirements/requirements-v0.1.md): 将来項目も含むversioned requirements。実装状況はREADMEと検証記録で確認。
- [Web Demoの構成・データ・保存方式](web-demo.md#architecture)

## Verification

| 記録                                                                                      | 対象                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Web Demo](web-demo.md#verification)                                                      | メモリ内Repository、production static export、ブラウザE2E、4サイズの表示 |
| [iPhone Core v1](ios-device-core-v1-verification.md)                                      | iPhone 16のdevelopment build。権限、Calendar、保存・実行・再計画         |
| [iOS Simulator Core v1](ios-core-v1-e2e-verification.md)                                  | Goals / TasksからPreview、Today、Activity Log、再計画まで                |
| [iOS Settings / Calendar](ios-settings-calendar-verification.md)                          | timezone、通常・終日予定、空き時間計算                                   |
| [Core v1 UI / UX polish](core-v1-ui-polish.md)                                            | 主要導線、状態表示、長いタイトル、小画面の確認範囲                       |
| [Execution](milestone-5a-verification.md)                                                 | Complete / Skipとatomicな状態変更                                        |
| [Activity Log](milestone-5b-verification.md) / [権限修正](milestone-5b-permission-fix.md) | snapshot方式、RPC / grants / RLS                                         |
| [Guarded Replanning](milestone-5c-verification.md)                                        | 最新状態での承認、DB競合境界、履歴保持                                   |

記録中の「未実施」「次回」はその検証時点の状態です。過去のテスト件数も当時の結果として保持しています。
最新の実装範囲・テスト件数はrepository READMEを参照してください。

## Web Demo / portfolio

- [Web Demoのローカル起動・GitHub Pages公開手順](web-demo.md)
- [ポートフォリオ用の開発紹介・実機とブラウザの確認範囲](portfolio.md)
- [公開用スクリーンショット・サンプルデータ・Native撮影手順](screenshots/README.md)
- [公開準備・Security / Privacy監査・GitHub設定チェック](portfolio-release.md)
- [個人メールを非公開にするための履歴整理手順](history-privacy.md)
- [依存脆弱性・SDK 57互換更新・公開可否の評価](dependency-security.md)

## Development notes

- [Native setup、Supabase、migrations、任意OpenAI](development.md)
- [agent guide](../AGENTS.md): repositoryでの変更ルールと作業コマンド。

[Personal Team Release](ios-personal-release.md)で、Metro停止・USB解除後のiPhone単体利用と、
依存更新後のNative回帰を確認しました。再署名・上書きinstall手順と未確認範囲も記録しています。
