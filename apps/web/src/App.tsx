import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { CaseDetailLayout } from './components/layout/CaseDetailLayout'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AiSearchPage } from './pages/AiSearchPage'
import { AuditPage } from './pages/AuditPage'
import { JobsPage } from './pages/JobsPage'
import { ModelsPage } from './pages/ModelsPage'
import { PermissionsPage } from './pages/PermissionsPage'
import { PilotPage } from './pages/PilotPage'
import { RagAdminPage } from './pages/RagAdminPage'
import { StandaloneFilePage } from './pages/StandaloneFilePage'
import { CaseDetailPage } from './pages/CaseDetailPage'
import { MastersPage } from './pages/MastersPage'
import { RegisterPage } from './pages/RegisterPage'
import { SearchPage } from './pages/SearchPage'

export function App () {
  return (
    <Routes>
      <Route path="/cases/:displayId" element={<CaseDetailLayout />}>
        <Route index element={<CaseDetailPage />} />
      </Route>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/search" replace />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/ai" element={<AiSearchPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/rag" element={<RagAdminPage />} />
        <Route path="/rag/standalone" element={<StandaloneFilePage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/masters" element={<MastersPage />} />
        <Route path="/permissions" element={<PermissionsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/pilot" element={<PilotPage />} />
      </Route>
    </Routes>
  )
}
