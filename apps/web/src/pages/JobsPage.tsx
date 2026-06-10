import { useCallback, useEffect, useState } from 'react'
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
  const [stats, setStats] = useState<JobStats>(emptyStats)
  const [items, setItems] = useState<JobItem[]>([])
  const [status, setStatus] = useState('')
  const [jobType, setJobType] = useState('')
  const [caseDisplayId, setCaseDisplayId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  // 適用済みフィルタ（絞り込みボタンで確定）。入力途中の値でポーリングしない。
  const [appliedFilters, setAppliedFilters] = useState({ status: '', jobType: '', caseDisplayId: '' })

  // 適用済みフィルタを依存に持たせ、ポーリングが古いフィルタへ巻き戻らないようにする
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
    <section className="page">
      <h2>ジョブ状態</h2>
      <div className="stats-row">
        <span>running: {stats.running}</span>
        <span>pending: {stats.pending}</span>
        <span>failed: {stats.failed}</span>
        <span>DLQ: {stats.dead_letter}</span>
        <span>completed today: {stats.completed_today}</span>
      </div>

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
          onClick={() => setAppliedFilters({ status, jobType, caseDisplayId })}
        >
          絞り込み
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      <p className="meta">{total} 件</p>

      <table className="data-table">
        <thead>
          <tr>
            <th>更新</th>
            <th>種別</th>
            <th>状態</th>
            <th>ケース</th>
            <th>再試行</th>
            <th>エラー</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>{row.updated_at?.slice(0, 19).replace('T', ' ')}</td>
              <td>{row.job_type}</td>
              <td><span className={`status status-${row.status}`}>{row.status}</span></td>
              <td>{row.case_display_id ?? '—'}</td>
              <td>{row.retry_count}/{row.max_attempts}</td>
              <td>{row.error ?? '—'}</td>
              <td>
                {(row.status === 'failed' || row.status === 'dead_letter') && (
                  <button type="button" className="linkish" onClick={() => void retry(row.id)}>再試行</button>
                )}
                {row.status === 'failed' && (
                  <button type="button" className="linkish" onClick={() => void toDlq(row.id)}>DLQ</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
