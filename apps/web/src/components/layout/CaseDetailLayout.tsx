import { Link, Outlet } from 'react-router-dom'
import { OllamaStatusBadge } from '../OllamaStatusBadge'
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
        <OllamaStatusBadge />
        <span className="gh-user">{me?.display_name ?? '—'}</span>
      </header>
      <div className="container">
        <Outlet />
      </div>
    </div>
  )
}
