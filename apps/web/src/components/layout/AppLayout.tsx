import { Outlet } from 'react-router-dom'
import { AppVersionLabel } from '../AppVersionLabel'
import { GhHeader } from './GhHeader'
import { AppSidebar } from './AppSidebar'
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed'

export function AppLayout () {
  const [collapsed] = useSidebarCollapsed()

  return (
    <>
      <GhHeader />
      <div className={`layout${collapsed ? ' sidebar-collapsed' : ''}`} id="layout">
        <AppSidebar />
        <main id="mainContent">
          <Outlet />
          <p className="app-footer-mock-ref">
            <AppVersionLabel />
            <span className="app-footer-sep" aria-hidden="true">·</span>
            参照: <a href="/mockups/webui.html" target="_blank" rel="noopener noreferrer">HTML モック（設計参照）</a>
          </p>
        </main>
      </div>
    </>
  )
}
