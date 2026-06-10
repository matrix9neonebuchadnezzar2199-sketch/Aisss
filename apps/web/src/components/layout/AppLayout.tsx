import { Outlet } from 'react-router-dom'
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
            参照: <a href="/mockups/webui.html" target="_blank" rel="noopener noreferrer">HTML モック（設計参照）</a>
          </p>
        </main>
      </div>
    </>
  )
}
