import { NavLink, Route, Routes } from 'react-router-dom'
import { ApiStatus } from './components/ApiStatus'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AiSearchPage } from './pages/AiSearchPage'
import { AuditPage } from './pages/AuditPage'
import { JobsPage } from './pages/JobsPage'
import { ModelsPage } from './pages/ModelsPage'
import { PilotPage } from './pages/PilotPage'
import { RagAdminPage } from './pages/RagAdminPage'
import { StandaloneFilePage } from './pages/StandaloneFilePage'
import { CaseDetailPage } from './pages/CaseDetailPage'
import { HomePage } from './pages/HomePage'
import { MastersPage } from './pages/MastersPage'
import { RegisterPage } from './pages/RegisterPage'
import { SearchPage } from './pages/SearchPage'
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
              end={item.path === '/'}
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
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/ai" element={<AiSearchPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/rag" element={<RagAdminPage />} />
          <Route path="/rag/standalone" element={<StandaloneFilePage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/cases/:displayId" element={<CaseDetailPage />} />
          <Route path="/masters" element={<MastersPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/pilot" element={<PilotPage />} />
        </Routes>
      </main>
    </div>
  )
}
