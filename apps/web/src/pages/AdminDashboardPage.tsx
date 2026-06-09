import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAdminDashboard, type AdminDashboard } from '../lib/api'

const empty: AdminDashboard = {
  cases: 0,
  failed_extractions: 0,
  failed_jobs: 0,
  rag_chunks: 0,
  audit_events_today: 0,
  open_feedback: 0
}

export function AdminDashboardPage () {
  const [dashboard, setDashboard] = useState(empty)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchAdminDashboard()
      .then(setDashboard)
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <section className="page">
      <h2>管理ダッシュボード</h2>
      {error && <p className="error">{error}</p>}
      <div className="dashboard-grid">
        <Metric label="ケース" value={dashboard.cases} to="/search" />
        <Metric label="失敗抽出" value={dashboard.failed_extractions} to="/rag" />
        <Metric label="失敗ジョブ" value={dashboard.failed_jobs} to="/jobs" />
        <Metric label="RAG チャンク" value={dashboard.rag_chunks} to="/rag" />
        <Metric label="本日監査" value={dashboard.audit_events_today} to="/audit" />
        <Metric label="未完了 feedback" value={dashboard.open_feedback} to="/pilot" />
      </div>
      <p className="hint">
        バックアップ・復元の実施記録は API <code>/api/admin/backup-checks</code> に保存します。
      </p>
    </section>
  )
}

function Metric ({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link className="metric-card" to={to}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  )
}
