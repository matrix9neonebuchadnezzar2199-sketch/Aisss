import { NavLink, Route, Routes } from 'react-router-dom'
import { ApiStatus } from './components/ApiStatus'
import { PlaceholderPage } from './components/PlaceholderPage'
import { navItems } from './routes'

export function App () {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">AISSS</div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <a className="mock-link" href="/mockups/webui.html" target="_blank" rel="noopener noreferrer">
          HTML モックを開く
        </a>
      </aside>
      <main className="content">
        <header className="topbar">
          <h1>AISSS WebUI</h1>
          <ApiStatus />
        </header>
        <Routes>
          {navItems.map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={
                <PlaceholderPage
                  title={item.label}
                  description={item.description}
                />
              }
            />
          ))}
          <Route path="*" element={<PlaceholderPage title="Not Found" description="画面が見つかりません。" />} />
        </Routes>
      </main>
    </div>
  )
}
