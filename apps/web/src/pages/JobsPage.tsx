import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  deadLetterJob,
  fetchJobs,
  fetchJobStats,
  retryJob,
  type JobItem,
  type JobStats
} from '../lib/api'

const emptyStats: JobStats = {
  running: 0,
  pending: 0,
  failed: 0,
  dead_letter: 0,
  completed_today: 0,
  by_type: {}
}

export function JobsPage () {
  const [searchParams] = useSearchParams()
  const [stats, setStats] = useState<JobStats>(emptyStats)
  const [items, setItems] = useState<JobItem[]>([])
  const [status, setStatus] = useState('')
  const [jobType, setJobType] = useState('')
  const [caseDisplayId, setCaseDisplayId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [appliedFilters, setAppliedFilters] = useState({ status: '', jobType: '', caseDisplayId: '' })

  useEffect(() => {
    const s = searchParams.get('status') ?? ''
    const jt = searchParams.get('job_type') ?? ''
    const c = searchParams.get('case') ?? ''
    setStatus(s)
    setJobType(jt)
    setCaseDisplayId(c)
    setAppliedFilters({ status: s, jobType: jt, caseDisplayId: c })
  }, [searchParams])

  const load = useCallback(async () => {
    const params = {
      ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
      ...(appliedFilters.jobType ? { job_type: appliedFilters.jobType } : {}),
      ...(appliedFilters.caseDisplayId ? { case: appliedFilters.caseDisplayId } : {})
    }
    const [s, j] = await Promise.all([fetchJobStats(), fetchJobs(params)])
    setStats(s)
    setItems(j.items)
    setTotal(j.total)
  }, [appliedFilters])

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message))
    const timer = window.setInterval(() => {
      void load().catch((e: Error) => setError(e.message))
    }, 10000)
    return () => window.clearInterval(timer)
  }, [load])

  async function retry (id: string) {
    try {
      await retryJob(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '再試行に失敗しました')
    }
  }

  async function toDlq (id: string) {
    try {
      await deadLetterJob(id, 'Moved from WebUI')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'DLQ への移動に失敗しました')
    }
  }

  return (
    <section className="view active" id="view-jobs">
      <div className="stats">
        <div className="stat-card">
          <div className="num">{stats.running}</div>
          <div className="lbl">実行中</div>
        </div>
        <div className="stat-card">
          <div className="num num-warning">{stats.pending}</div>
          <div className="lbl">待機</div>
        </div>
        <div className="stat-card">
          <div className="num num-danger">{stats.failed}</div>
          <div className="lbl">失敗</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats.dead_letter}</div>
          <div className="lbl">DLQ</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats.completed_today}</div>
          <div className="lbl">本日完了</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>ジョブ状態</h2>
          <Link className="btn btn-sm" to="/audit">監査ログ</Link>
        </div>
        <div className="panel-body">
          <div className="filter-panel audit-filters">
            <label>種別
              <input value={jobType} onChange={(e) => setJobType(e.target.value)} placeholder="extraction / embedding" />
            </label>
            <label>状態
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">すべて</option>
                <option value="pending">pending</option>
                <option value="running">running</option>
                <option value="failed">failed</option>
                <option value="dead_letter">dead_letter</option>
                <option value="completed">completed</option>
              </select>
            </label>
            <label>ケース
              <input value={caseDisplayId} onChange={(e) => setCaseDisplayId(e.target.value)} placeholder="CASE-..." />
            </label>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setAppliedFilters({ status, jobType, caseDisplayId })}
            >
              絞り込み
            </button>
          </div>

          {error && <p className="error">{error}</p>}
          <p className="meta">{total} 件 · 10 秒ごとに自動更新</p>

          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">更新</th>
                <th scope="col">種別</th>
                <th scope="col">状態</th>
                <th scope="col">ケース</th>
                <th scope="col">再試行</th>
                <th scope="col">エラー</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.updated_at?.slice(0, 19).replace('T', ' ')}</td>
                  <td>{row.job_type}</td>
                  <td><span className={`status status-${row.status}`}>{row.status}</span></td>
                  <td>
                    {row.case_display_id ? (
                      <>
                        <Link to={`/cases/${row.case_display_id}`} target="_blank" rel="noopener noreferrer">
                          {row.case_display_id}
                        </Link>
                        {' · '}
                        <Link to={`/audit?case=${encodeURIComponent(row.case_display_id)}`}>監査</Link>
                      </>
                    ) : '—'}
                  </td>
                  <td>{row.retry_count}/{row.max_attempts}</td>
                  <td>{row.error ?? '—'}</td>
                  <td>
                    {(row.status === 'failed' || row.status === 'dead_letter') && (
                      <button type="button" className="btn btn-sm" onClick={() => void retry(row.id)}>再試行</button>
                    )}
                    {row.status === 'failed' && (
                      <button type="button" className="btn btn-sm" onClick={() => void toDlq(row.id)}>DLQ</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
