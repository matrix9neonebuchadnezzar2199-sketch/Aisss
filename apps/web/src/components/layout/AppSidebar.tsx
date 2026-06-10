import { NavLink } from 'react-router-dom'
import { sidebarGroups } from '../../routes'
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed'

export function AppSidebar () {
  const [collapsed, toggle] = useSidebarCollapsed()

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`} id="sidebar">
      <div className="sidebar-top">
        <span className="sidebar-top-title">メニュー</span>
        <button
          type="button"
          className="sidebar-toggle"
          title="サイドバーを折りたたむ"
          aria-label="サイドバーを折りたたむ"
          onClick={toggle}
        >
          ‹
        </button>
      </div>
      <nav className="sidebar-nav">
        {sidebarGroups.map((group) => (
          <div key={group.title}>
            <p className="sidebar-group-title">{group.title}</p>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                title={item.title}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <span className="nav-lead">　</span>
                <span className="nav-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
