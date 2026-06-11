# 21 — バージョン管理

AISSS のリリース番号とビルド識別子の運用。UI に表示する目的は **「push したのに画面が古い」問題を一目で判別** すること。

## 表示形式

```
v{SemVer} ({git short SHA})
```

例: `v0.2.0 (79114fd)`

| 場所 | 内容 |
|---|---|
| Web フッター（全画面） | 上記ラベル + HTML モック参照リンク |
| Web ヘッダー右 | 同ラベル（コンパクト） |
| ケース詳細（standalone） | フッターのみ |
| `GET /api/health` | `version`, `git_sha` フィールド |

## 番号の意味（SemVer）

[Semantic Versioning](https://semver.org/) に従う。正本は **リポジトリ直下 `package.json` の `version`**。

| 桁 | 上げるタイミング | 例 |
|---|---|---|
| **MAJOR** (1.0.0) | API / データ契約の破壊的変更 | ケース JSON スキーマ非互換 |
| **MINOR** (0.3.0) | 後方互換の機能追加 | 新画面、新 API エンドポイント |
| **PATCH** (0.2.1) | 後方互換の修正 | UI レイアウト修正、バグ修正 |

変更履歴は [CHANGELOG.md](../CHANGELOG.md)（Keep a Changelog 形式）。

## git SHA について

- **ビルド時に自動注入**（手動更新不要）
- Docker ビルド: ホストの `git rev-parse --short HEAD` を `GIT_SHA` build-arg で渡す
- ローカル `npm run build`: vite が git を直接読む（`.git` がある場合）
- git 不可環境: `dev` / `unknown`

### なぜ「push 番号」ではなく commit SHA か

| 方式 | 長所 | 短所 |
|---|---|---|
| **GitHub push 番号** | 連番で覚えやすい | Actions/run 依存、リポジトリ間で意味が違う、ローカルビルドと一致しない |
| **git short SHA**（採用） | コードと 1:1、GitHub のコミット URL と一致、業界標準 | 人間には読みにくい |

同様の慣習: Sentry `release@1.0.0+sha`、多くの SaaS の `/version` JSON、Kubernetes `app.kubernetes.io/version` + イメージ digest。

## リリース手順

1. [CHANGELOG.md](../CHANGELOG.md) の `[Unreleased]` を `[X.Y.Z] - YYYY-MM-DD` に確定
2. ルート `package.json` の `version` を更新（必要なら `apps/web` / `apps/api` も同期）
3. コミット → push
4. **必須**: `make deploy-web` / `make deploy`（Windows: `pwsh scripts/deploy-web.ps1`）
5. ブラウザでフッターの `vX.Y.Z (abcdef0)` が期待どおりか確認
6. （任意）Git tag `vX.Y.Z` を GitHub に作成

## ビルド変数

| 変数 | 用途 |
|---|---|
| `APP_VERSION` | SemVer（compose build-arg / Makefile export） |
| `GIT_SHA` | short SHA（compose build-arg） |
| `VITE_APP_VERSION` / `VITE_GIT_SHA` | Web イメージ build 段階（Vite define） |
| `AISSS_VERSION` / `AISSS_GIT_SHA` | API コンテナ runtime env |

Windows で手動ビルドする場合:

```powershell
cd F:\Cursor\Aisss
pwsh scripts/deploy-web.ps1
```

## 検証

`scripts/verify-docker-deploy.ps1` は以下を確認する:

- Web CSS が M19 以降のサイズ
- バンドル JS に **現在の git HEAD** と **package.json version** が含まれる

不一致なら stale image として exit 1。

## 関連

- [13-deployment-docker.md](./13-deployment-docker.md) — Docker デプロイ
- [CHANGELOG.md](../CHANGELOG.md) — 変更履歴
- Rule `55-aisss-docker-deploy.mdc` — push ≠ deploy
