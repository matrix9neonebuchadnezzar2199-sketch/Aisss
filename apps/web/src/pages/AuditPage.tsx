import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch, getUserId } from '../lib/api'

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
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState<AuditRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [action, setAction] = useState('')
  const [caseDisplayId, setCaseDisplayId] = useState('')
  const [queryId, setQueryId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [detailRow, setDetailRow] = useState<AuditRow | null>(null)

  function buildFilterParams (caseOverride?: string): URLSearchParams {
    const params = new URLSearchParams()
    if (action) params.set('action', action)
    const caseVal = caseOverride ?? caseDisplayId
    if (caseVal) params.set('case', caseVal)
    if (queryId) params.set('query_id', queryId)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    return params
  }

  async function load (caseOverride?: string) {
    const params = buildFilterParams(caseOverride)
    await apiFetch<{ items: AuditRow[]; total: number }>(`/api/audit-logs?${params}`)
      .then((d) => {
        setItems(d.items)
        setTotal(d.total)
      })
      .catch((e: Error) => setError(e.message))
  }

  async function downloadCsv () {
    setError(null)
    try {
      const params = buildFilterParams()
      params.set('export', 'csv')
      const res = await fetch(`/api/audit-logs?${params}`, {
        headers: { 'X-AISSS-User-Id': getUserId() }
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(body.error?.message ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'audit-logs.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CSV エクスポートに失敗しました')
    }
  }

  useEffect(() => {
    const c = searchParams.get('case') ?? ''
    if (c) setCaseDisplayId(c)
    void load(c || undefined)
  }, [searchParams])

  return (
    <section className="view active" id="view-audit">
      <div className="panel">
        <div className="panel-header">
          <h2>監査ログ</h2>
          <Link className="btn btn-sm" to="/jobs">ジョブ状態</Link>
        </div>
        <div className="panel-body">
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
              <button type="button" className="btn btn-sm btn-primary" onClick={() => void load()}>絞り込み</button>
              <button type="button" className="btn btn-sm" onClick={() => void downloadCsv()}>CSV</button>
            </div>
          </div>

          {error && <p className="error">{error}</p>}
          <p className="meta">{total} 件</p>

          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">日時</th>
                <th scope="col">ユーザー</th>
                <th scope="col">アクション</th>
                <th scope="col">リソース</th>
                <th scope="col">ケース</th>
                <th scope="col">クエリ</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.created_at?.slice(0, 19).replace('T', ' ')}</td>
                  <td>{row.user_name ?? '—'}</td>
                  <td>{row.action}</td>
                  <td>{row.resource_type ?? '—'} {row.resource_id ? row.resource_id.slice(0, 8) : ''}</td>
                  <td>
                    {row.case_display_id ? (
                      <>
                        <Link to={`/cases/${row.case_display_id}`} target="_blank" rel="noopener noreferrer">
                          {row.case_display_id}
                        </Link>
                        {' · '}
                        <Link to={`/register?edit=${encodeURIComponent(row.case_display_id)}`}>編集</Link>
                      </>
                    ) : '—'}
                  </td>
                  <td>
                    {row.query_id ? (
                      <Link to={`/ai?query_id=${encodeURIComponent(row.query_id)}`}>{row.query_id.slice(0, 8)}…</Link>
                    ) : '—'}
                  </td>
                  <td>
                    <button type="button" className="btn btn-sm" onClick={() => setDetailRow(row)}>詳細</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailRow && (
        <div className="dialog-overlay" role="presentation" onClick={() => setDetailRow(null)}>
          <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <h3>監査イベント詳細</h3>
              <button type="button" className="btn btn-sm" onClick={() => setDetailRow(null)}>閉じる</button>
            </div>
            <div className="panel-body">
              <dl className="detail-meta">
                <dt>日時</dt><dd>{detailRow.created_at}</dd>
                <dt>アクション</dt><dd>{detailRow.action}</dd>
                <dt>ユーザー</dt><dd>{detailRow.user_name ?? '—'}</dd>
                <dt>ケース</dt>
                <dd>
                  {detailRow.case_display_id ? (
                    <Link to={`/cases/${detailRow.case_display_id}`} target="_blank" rel="noopener noreferrer">
                      {detailRow.case_display_id}
                    </Link>
                  ) : '—'}
                </dd>
                <dt>クエリ ID</dt><dd>{detailRow.query_id ?? '—'}</dd>
              </dl>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
