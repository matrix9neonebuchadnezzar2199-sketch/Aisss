import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

type AuditRow = {
  id: string
  action: string
  resource_type?: string
  resource_id?: string
  case_display_id?: string
  query_id?: string
  user_name?: string
  created_at: string
}

export function AuditPage () {
  const [items, setItems] = useState<AuditRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [action, setAction] = useState('')
  const [caseDisplayId, setCaseDisplayId] = useState('')
  const [queryId, setQueryId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  async function load () {
    const params = new URLSearchParams()
    if (action) params.set('action', action)
    if (caseDisplayId) params.set('case', caseDisplayId)
    if (queryId) params.set('query_id', queryId)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    await apiFetch<{ items: AuditRow[]; total: number }>(`/api/audit-logs?${params}`)
      .then((d) => {
        setItems(d.items)
        setTotal(d.total)
      })
      .catch((e: Error) => setError(e.message))
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <section className="page">
      <h2>監査ログ</h2>
      <div className="filter-panel audit-filters">
        <label>アクション
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="ai.chat" />
        </label>
        <label>表示 ID
          <input value={caseDisplayId} onChange={(e) => setCaseDisplayId(e.target.value)} placeholder="CASE-..." />
        </label>
        <label>クエリ ID
          <input value={queryId} onChange={(e) => setQueryId(e.target.value)} />
        </label>
        <label>開始
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label>終了
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <div className="inline-actions">
          <button type="button" onClick={() => void load()}>絞り込み</button>
          <a className="primary" href="/api/audit-logs?export=csv">CSV</a>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <p className="meta">{total} 件</p>
      <table className="data-table">
        <thead>
          <tr><th>日時</th><th>ユーザー</th><th>アクション</th><th>リソース</th><th>ケース</th><th>クエリ</th></tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>{row.created_at?.slice(0, 19).replace('T', ' ')}</td>
              <td>{row.user_name ?? '—'}</td>
              <td>{row.action}</td>
              <td>{row.resource_type ?? '—'} {row.resource_id ? row.resource_id.slice(0, 8) : ''}</td>
              <td>{row.case_display_id ?? '—'}</td>
              <td>{row.query_id ? row.query_id.slice(0, 8) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
