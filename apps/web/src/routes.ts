export type NavItem = {
  path: string
  label: string
}

export const navItems: NavItem[] = [
  { path: '/', label: 'ホーム' },
  { path: '/search', label: 'ケース検索' },
  { path: '/ai', label: 'AI 検索' },
  { path: '/register', label: 'ケース登録' },
  { path: '/rag', label: 'RAG 管理' },
  { path: '/models', label: 'モデル管理' },
  { path: '/masters', label: 'マスタ管理' },
  { path: '/audit', label: '監査ログ' }
]
