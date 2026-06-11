import { NavLink, useLocation } from 'react-router-dom'
import { AppVersionLabel } from '../AppVersionLabel'
import { adminSubmenuItems, topNavItems, type TopNavItem } from '../../routes'
import { useMe } from '../../hooks/useMe'
import { OllamaStatusBadge } from '../OllamaStatusBadge'
import { ThemePalettePanel } from '../theme/ThemePalettePanel'

function isTopNavActive (pathname: string, item: TopNavItem): boolean {
  if (item.matchPrefix) {
    return pathname.startsWith(item.matchPrefix) ||
      pathname === '/models' ||
      pathname === '/masters' ||
      pathname === '/permissions' ||
      pathname === '/audit' ||
      pathname === '/jobs' ||
      pathname === '/admin' ||
      pathname === '/pilot'
  }
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}

export function GhHeader () {
  const location = useLocation()
  const me = useMe()

  return (
    <header className="gh-header">
      <NavLink className="gh-logo" to="/search">
        <span className="gh-logo-mark">AI</span>
        <span>
          AISSS
          <span className="gh-logo-sub">Analytical Information Secure Sharing System</span>
        </span>
      </NavLink>
      <nav className="gh-nav">
        {topNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={isTopNavActive(location.pathname, item) ? 'active' : undefined}
          >
            {item.label}
          </NavLink>
        ))}
        <details className="gh-admin-menu">
          <summary>運用</summary>
          <div className="gh-admin-dropdown">
            {adminSubmenuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </details>
      </nav>
      <div className="gh-header-tools">
        <ThemePalettePanel />
        <OllamaStatusBadge />
        <AppVersionLabel className="gh-version-label" />
        <span className="gh-user">{me?.display_name ?? '—'} / {me?.role ?? '…'}</span>
      </div>
    </header>
  )
}
