# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- （リリース前の変更をここに追記）

## [0.2.0] - 2026-06-11

### Added

- M19: HTML モック準拠の Web UI（GhHeader / AppSidebar / panel レイアウト）
- Permissions 管理画面、クロスナビ（stats→jobs、RAG→edit 等）
- ケース登録画面の `form-section` レイアウト整備
- **SemVer + git SHA** のビルド表示（フッター・ヘッダー、`/api/health`）
- Docker deploy 検証（`verify-docker-deploy`、build SHA 一致チェック）

### Changed

- ルート `/` を `/search` にリダイレクト

## [0.1.0] - 2026-06-01

### Added

- 初期 API / Web / Worker スケルトン、Docker Compose 基盤

[Unreleased]: https://github.com/compare/...HEAD
[0.2.0]: https://github.com/compare/...
[0.1.0]: https://github.com/compare/...
