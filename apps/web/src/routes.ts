export type NavItem = {
  path: string
  label: string
}

export const navItems: NavItem[] = [
  { path: '/', label: 'ホーム' },
  { path: '/search', label: 'ケース検索' },
  { path: '/register', label: 'ケース登録' },
  { path: '/masters', label: 'マスタ管理' },
  { path: '/audit', label: '監査ログ' }
]
