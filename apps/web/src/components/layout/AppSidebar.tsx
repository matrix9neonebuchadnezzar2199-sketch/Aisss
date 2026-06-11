import { NavLink } from 'react-router-dom'
import { sidebarGroups } from '../../routes'

type AppSidebarProps = {
  collapsed: boolean
  onToggle: () => void
}

export function AppSidebar ({ collapsed, onToggle }: AppSidebarProps) {
  const toggleTitle = collapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`} id="sidebar">
      <div className="sidebar-top">
        <span className="sidebar-top-title">メニュー</span>
        <button
          type="button"
          className="sidebar-toggle"
          title={toggleTitle}
          aria-label={toggleTitle}
          aria-expanded={!collapsed}
          onClick={onToggle}
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
