export type SidebarItem = {
  path: string
  label: string
  icon: string
  title: string
}

export type SidebarGroup = {
  title: string
  items: SidebarItem[]
}

export const sidebarGroups: SidebarGroup[] = [
  {
    title: '登録',
    items: [
      { path: '/register', label: 'ケース（事象）', icon: '✏️', title: 'ケース（事象）登録' }
    ]
  },
  {
    title: '検索',
    items: [
      { path: '/search', label: 'ケース（事象）', icon: '🔍', title: 'ケース（事象）検索' },
      { path: '/ai', label: 'AI 検索', icon: '🤖', title: 'AI 検索' }
    ]
  },
  {
    title: '管理',
    items: [
      { path: '/rag', label: 'RAG 管理', icon: '📚', title: 'RAG 管理' },
      { path: '/models', label: 'モデル管理（API 連携）', icon: '🧠', title: 'モデル管理（API 連携）' },
      { path: '/masters', label: 'マスタ管理', icon: '⚙️', title: 'マスタ管理' },
      { path: '/permissions', label: 'ユーザー・グループ管理', icon: '👥', title: 'ユーザー・グループ管理' },
      { path: '/audit', label: '監査ログ', icon: '📋', title: '監査ログ' },
      { path: '/jobs', label: 'ジョブ状態', icon: '⏳', title: 'ジョブ状態' }
    ]
  }
]

export type TopNavItem = {
  path: string
  label: string
  matchPrefix?: string
}

export const topNavItems: TopNavItem[] = [
  { path: '/search', label: '検索' },
  { path: '/register', label: '登録' },
  { path: '/ai', label: 'AI 検索' },
  { path: '/rag', label: '管理', matchPrefix: '/rag' }
]

export const adminSubmenuItems = [
  { path: '/admin', label: '管理ダッシュボード' },
  { path: '/pilot', label: '本番パイロット' }
]
