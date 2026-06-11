# M28 Go / No-Go 結果

記録日: **2026-06-11**（dev/lab 環境）。手順: [m28-pilot-dry-run.md](./m28-pilot-dry-run.md)。

## 判定

| 項目 | 値 |
|---|---|
| **判定** | **Conditional Go（条件付き Go）** |
| **理由** | 自動 baseline（`pilot-smoke.ps1`）は web redeploy 後 exit 0; backup-check 記録済; audit ガバナンスキー確認済。手動 persona walkthrough（steps 2–7, 9, 11）は **warn** — operator 本番相当環境での実施待ち。 |
| **Blocker** | なし（err なし） |
| **フォローアップ** | wider pilot 週の前に operator 環境で手動ステップを完了 |

## 自動 baseline

コマンド: `pwsh scripts/pilot-smoke.ps1 -RecordBackupCheck -SkipBuild`（`deploy-web.ps1` 後）

| チェック | 状態 | 詳細 |
|---|---|---|
| api_health | ok | v0.2.0, redeploy 後コンテナ git bfe90e7 |
| ollama_health | ok | ホスト到達可 |
| rag_eval | ok | 10 シナリオ pass |
| npm_test_api | ok | 54 pass, 5 skipped |
| npm_test_workers | ok | 20 pass |
| docker_verify | ok | CSS 49004B, build label bfe90e7 |
| admin_dashboard | ok | cases=3, failed_jobs=0, rag_chunks=4 |
| backup_check_recorded | ok | POST 201, scope=full-stack |

## Dry-run 12 ステップ

| Step | 担当 | 状態 | 証跡 / メモ |
|---|---|---|---|
| 1 | Admin | ok | pilot-smoke `api_health` |
| 2 | Admin | warn | 手動: ケース登録 + `全員` — 本セッション未実施 |
| 3 | Operator | warn | 手動: PDF アップロード抽出 — seed に添付あり |
| 4 | Operator | warn | 手動: 抽出後 RAG 自動 ON トグル |
| 5 | Operator | warn | 手動: `/rag` 未ナレッジ化候補 UI |
| 6 | Operator | warn | 手動: RAG 有効化 → embedding job |
| 7 | Pilot | warn | 手動: `/ai` 範囲内 citation — stream UX は別途確認済（bfe90e7） |
| 8 | Pilot | ok | `rag-eval.test.ts` — 照会禁止 / 範囲外 |
| 9 | Pilot | warn | 手動: pilot ユーザー一覧スコープ — CI `route-integration.test.ts` はローカル skip |
| 10 | Admin | ok | Audit spot-check: `ai.chat` に `excluded_counts` + `retrieved_case_ids` |
| 11 | Operator | warn | 手動: job retry — dashboard `failed_jobs=0`; retry フロー未実施 |
| 12 | All | ok | pilot-smoke テスト + build |

## Post-MVP backlog（gate レビューより）

| 項目 | トリガー | 優先度 |
|---|---|---|
| OCR/ASR 実装 | パイロット画像/音声 2 件以上でブロック | Post-MVP |
| ReRank 実行 ON | eval ループ後も retrieval ミスが続く | Post-MVP（方針: 配線まで OFF） |
| MAP 検索 | ユーザー要望 / mock スコープ | 延期 |
| Operator persona walkthrough | M20–M22 checklist warn のクローズ | wider pilot 前 |
| CI integration tests | step 9 自動化用 `INTEGRATION_DATABASE_URL` | Ops |

## 参照

- [20-webui-wiring-checklist.md § M28](./20-webui-wiring-checklist.md#m28-pilot-dry-run--go-no-go)
- [11-milestones.md § M28](./11-milestones.md#milestone-28-pilot-dry-run--go-no-go-closure)
- 開発日記: `ObsidianVault/90_DevLog/2026-06-11.md`
