export type NavItem = {
  path: string
  label: string
  description: string
}

export const navItems: NavItem[] = [
  { path: '/', label: 'ホーム', description: 'M1 スケルトン。各機能は順次実装します。' },
  { path: '/search', label: 'ケース検索', description: 'M2: GET /api/cases 連携予定。' },
  { path: '/register', label: 'ケース登録', description: 'M2: POST/PATCH /api/cases 連携予定。' },
  { path: '/ai', label: 'AI 検索', description: 'M5: POST /api/ai/chat 連携予定。' },
  { path: '/rag-admin', label: 'RAG 管理', description: 'M5: RAG 管理 API 連携予定。' },
  { path: '/models', label: 'モデル管理', description: 'M5: Ollama モデルロール連携予定。' },
  { path: '/permissions', label: 'ユーザー・グループ', description: 'M2: 権限 API 連携予定。' },
  { path: '/masters', label: 'マスタ管理', description: 'M2: マスタ API 連携予定。' },
  { path: '/audit', label: '監査ログ', description: 'M6: GET /api/audit-logs 連携予定。' },
  { path: '/jobs', label: 'ジョブ状態', description: 'M6: GET /api/jobs 連携予定。' }
]
