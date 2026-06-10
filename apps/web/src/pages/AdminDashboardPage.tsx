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
    <section className="view active" id="view-admin">
      <div className="panel">
        <div className="panel-header">
          <h2>管理ダッシュボード</h2>
          <span className="label label-info">運用メニュー</span>
        </div>
        <div className="panel-body">
          {error && <p className="error">{error}</p>}
          <div className="stats">
            <MetricLink label="ケース" value={dashboard.cases} to="/search" />
            <MetricLink label="失敗抽出" value={dashboard.failed_extractions} to="/rag" />
            <MetricLink label="失敗ジョブ" value={dashboard.failed_jobs} to="/jobs?status=failed" />
            <MetricLink label="RAG チャンク" value={dashboard.rag_chunks} to="/rag" />
            <MetricLink label="本日監査" value={dashboard.audit_events_today} to="/audit" />
            <MetricLink label="未完了 feedback" value={dashboard.open_feedback} to="/pilot" />
          </div>
          <p className="rag-register-note">
            バックアップ・復元の実施記録は API <code>/api/admin/backup-checks</code> に保存します。
          </p>
        </div>
      </div>
    </section>
  )
}

function MetricLink ({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link className="stat-card stat-link" to={to}>
      <div className="num">{value.toLocaleString()}</div>
      <div className="lbl">{label} →</div>
    </Link>
  )
}
