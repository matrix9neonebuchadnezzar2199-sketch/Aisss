import { Link, Outlet } from 'react-router-dom'
import { AppVersionLabel } from '../AppVersionLabel'
import { OllamaStatusBadge } from '../OllamaStatusBadge'
import { ThemePalettePanel } from '../theme/ThemePalettePanel'
import { useMe } from '../../hooks/useMe'

export function CaseDetailLayout () {
  const me = useMe()

  return (
    <div className="case-detail-standalone">
      <header className="gh-header">
        <Link className="gh-logo" to="/search">
          <span className="gh-logo-mark">AI</span>
          <span>
            AISSS
            <span className="gh-logo-sub">ケース詳細</span>
          </span>
        </Link>
        <div className="gh-header-tools">
          <ThemePalettePanel />
          <OllamaStatusBadge />
          <span className="gh-user">{me?.display_name ?? '—'}</span>
        </div>
      </header>
      <div className="container">
        <Outlet />
        <p className="app-footer-mock-ref">
          <AppVersionLabel />
        </p>
      </div>
    </div>
  )
}
