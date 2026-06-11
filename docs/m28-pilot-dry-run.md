# M28 パイロット dry-run / Go-No-Go

wider pilot 前の M28 gate。詳細運用は [19-operational-runbook.md](./19-operational-runbook.md)、WebUI 観点は [20-webui-wiring-checklist.md](./20-webui-wiring-checklist.md#m28-pilot-dry-run--go-no-go) を参照。

## 前提

| 項目 | Windows (PowerShell) | Unix |
|---|---|---|
| スタック起動 | `docker compose -f aisss/docker-compose.yaml up -d` | `make up` |
| ホスト Ollama | `ollama list` で chat モデルが見える | 同上 |
| 開発ユーザー | admin `…000001`, operator `…000002`, pilot `…000003` | seed `003_dev_seed.sql`, `007_m6_m7_ops_pilot.sql` |

## 自動 baseline（最初に実行）

```powershell
cd F:\Cursor\Aisss
pwsh scripts/pilot-smoke.ps1 -RecordBackupCheck
```

対象: `/api/health`, `/api/ollama/health`, `rag-eval.test.ts`, API/worker 全テスト, web build, Docker verify, 管理ダッシュボード, 任意で `POST /api/admin/backup-checks`。

## 手動 dry-run（12 ステップ）

各ステップを **ok | warn | err** で [m28-go-no-go-results.md](./m28-go-no-go-results.md) と `ObsidianVault/90_DevLog/YYYY-MM-DD.md` に記録する。

| Step | 担当 | 操作 | 期待結果 | 証跡の場所 |
|---|---|---|---|---|
| 1 | Admin | スタック + `/api/health` | 200, `status: ok` | pilot-smoke `api_health` |
| 2 | Admin | ケース登録、閲覧範囲 `全員` | 保存成功; 空範囲は PATCH 拒否 | `/register`, audit `case.create` |
| 3 | Operator | PDF アップロード、自動 ON は OFF | `extraction_status=succeeded`, RAG OFF | `/cases/:id`, `/jobs` |
| 4 | Operator | `抽出後RAG自動ON` を有効化して再アップロード | `auto_enable_rag_on_extraction=true` | attachment 行 |
| 5 | Operator | `/rag` | 未ナレッジ化候補が表示される | stats カード + テーブルハイライト |
| 6 | Operator | 抽出済みファイルで RAG 有効化 | embedding job `pending`→`completed` | `/jobs?job_type=embedding` |
| 7 | Pilot | 範囲内ケースで `/ai` 照会 | 許可された `display_id` の citation のみ | チャット + audit `ai.chat` |
| 8 | Pilot | `照会禁止` ケースに触れる照会 | citation / コンテキスト漏洩なし | pilot-smoke `rag_eval` + 手動 spot-check |
| 9 | Pilot | `/search` またはケース一覧 | `全員` のみ見える。analyst-only は不可 | ユーザ切替 / UI |
| 10 | Admin | `/audit?query_id=…` | `details_json.excluded_counts` あり; 禁止タイトル漏洩なし | audit 詳細ダイアログ |
| 11 | Operator | `/jobs` で失敗 job を retry | status → pending; audit `job.retry` | jobs 表 + audit |
| 12 | All | CI 同等 | テスト + build 成功 | pilot-smoke サマリ |

## Go / No-Go 判定

| 判定 | 条件 |
|---|---|
| **Go** | 自動 smoke 全項目 ok; 手動 steps 2–11 が ok、または owner+期限付き warn; backup-check 記録済; **err** blocker なし |
| **Conditional go（条件付き Go）** | Ollama のみ warn（step 1 ok, ollama warn）; 手動 RAG/AI ステップは owner 付きで 1 週間延期 |
| **No-go** | 権限回帰 **err**（step 8）、audit 漏洩 **err**（step 10）、job retry 不具合 **err**（step 11）のいずれか |

## Blocker → backlog 振り分け

| パターン | 行き先 |
|---|---|
| UI / レイアウト回帰 | M28 fix PR → 該当 checklist 行を再実行 |
| OCR/ASR 必要（パイロットファイル 2 件以上） | runbook の cut 基準どおり Post-MVP |
| 検索品質ミス | M26 eval 拡張 + embedding モデル見直し |
| audit キー欠落 | API 修正 + step 10 再実行 |

## ペルソナ切替（開発）

WebUI ホームまたは `localStorage` / リクエストヘッダで設定:

- Admin: `X-AISSS-User-Id: 00000000-0000-4000-8000-000000000001`
- Operator: `00000000-0000-4000-8000-000000000002`
- Pilot: `00000000-0000-4000-8000-000000000003`
