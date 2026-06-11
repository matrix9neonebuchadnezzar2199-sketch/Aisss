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
      <div className="stats">
        <Link className="stat-card stat-link" to="/search">
          <div className="num">{dashboard.cases.toLocaleString()}</div>
          <div className="lbl">登録ケース →</div>
        </Link>
        <Link className="stat-card stat-link" to="/rag">
          <div className="num num-warning">{dashboard.failed_extractions}</div>
          <div className="lbl">失敗抽出 →</div>
        </Link>
        <Link className="stat-card stat-link" to="/jobs?status=failed">
          <div className="num num-danger">{dashboard.failed_jobs}</div>
          <div className="lbl">失敗ジョブ →</div>
        </Link>
        <Link className="stat-card stat-link" to="/rag">
          <div className="num">{dashboard.rag_chunks.toLocaleString()}</div>
          <div className="lbl">RAG チャンク →</div>
        </Link>
        <Link className="stat-card stat-link" to="/audit">
          <div className="num">{dashboard.audit_events_today.toLocaleString()}</div>
          <div className="lbl">本日監査 →</div>
        </Link>
        <Link className="stat-card stat-link" to="/pilot">
          <div className="num num-warning">{dashboard.open_feedback}</div>
          <div className="lbl">未完了 feedback →</div>
        </Link>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>管理ダッシュボード</h2>
          <span className="label label-info">運用メニュー</span>
        </div>
        <div className="panel-body">
          {error && <p className="error">{error}</p>}
          <p className="rag-register-note">
            上段の数値カードから各管理画面へ移動できます。バックアップ・復元の実施記録は API{' '}
            <code>/api/admin/backup-checks</code> に保存します。
          </p>
          <div className="form-section">
            <h3>クイックリンク</h3>
            <div className="admin-quick-links">
              <Link className="btn btn-sm" to="/rag">RAG 管理</Link>
              <Link className="btn btn-sm" to="/models">モデル管理</Link>
              <Link className="btn btn-sm" to="/masters">マスタ管理</Link>
              <Link className="btn btn-sm" to="/permissions">ユーザー・グループ</Link>
              <Link className="btn btn-sm" to="/jobs">ジョブ状態</Link>
              <Link className="btn btn-sm" to="/audit">監査ログ</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
