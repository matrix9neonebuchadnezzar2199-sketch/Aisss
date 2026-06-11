import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch, fetchAuditStats, getUserId, type AuditStats } from '../lib/api'
import { CollapsibleFilterPanel } from '../components/layout/CollapsibleFilterPanel'

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
  const urlCase = searchParams.get('case') ?? ''
  const urlQueryId = searchParams.get('query_id') ?? ''
  const [items, setItems] = useState<AuditRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [action, setAction] = useState('')
  const [caseDisplayId, setCaseDisplayId] = useState('')
  const [queryId, setQueryId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [detailRow, setDetailRow] = useState<AuditRow | null>(null)
  const [stats, setStats] = useState<AuditStats>({
    total_today: 0,
    case_ops: 0,
    ai_ops: 0,
    permission_ops: 0
  })

  function buildFilterParams (overrides?: { case?: string; query_id?: string }): URLSearchParams {
    const params = new URLSearchParams()
    if (action) params.set('action', action)
    const caseVal = overrides?.case ?? caseDisplayId
    if (caseVal) params.set('case', caseVal)
    const qVal = overrides?.query_id ?? queryId
    if (qVal) params.set('query_id', qVal)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    return params
  }

  async function load (overrides?: { case?: string; query_id?: string }) {
    const params = buildFilterParams(overrides)
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
    void fetchAuditStats().then(setStats).catch(() => {})
  }, [])

  const urlInit = useRef<string>('')
  useEffect(() => {
    if (urlCase) setCaseDisplayId(urlCase)
    if (urlQueryId) setQueryId(urlQueryId)

    const key = `${urlCase}|${urlQueryId}`
    if (urlInit.current === key) return
    urlInit.current = key

    void load({
      ...(urlCase ? { case: urlCase } : {}),
      ...(urlQueryId ? { query_id: urlQueryId } : {})
    })
  }, [urlCase, urlQueryId])

  return (
    <section className="view active" id="view-audit">
      <div className="stats">
        <div className="stat-card">
          <div className="num">{stats.total_today}</div>
          <div className="lbl">本日のイベント</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats.case_ops}</div>
          <div className="lbl">ケース操作</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats.ai_ops}</div>
          <div className="lbl">AI 質問</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats.permission_ops}</div>
          <div className="lbl">権限・マスタ変更</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>監査ログ</h2>
          <Link className="btn btn-sm" to="/jobs">ジョブ状態</Link>
        </div>
        <div className="panel-body">
          <p className="rag-register-note">
            登録・閲覧・ダウンロード・AI 質問・権限変更などの操作履歴です。制限ケースの<strong>本文は表示しません</strong>（監査権限のみ詳細参照）。
          </p>

          <CollapsibleFilterPanel storageKey="aisss-audit-filter-collapsed" title="絞り込み条件">
            <div className="audit-filter-panel">
              <div className="filter-bar audit-filter-row">
                <input
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  placeholder="アクション（例: ai.chat）"
                />
                <input
                  value={caseDisplayId}
                  onChange={(e) => setCaseDisplayId(e.target.value)}
                  placeholder="表示 ID"
                  className="mono"
                />
                <input
                  value={queryId}
                  onChange={(e) => setQueryId(e.target.value)}
                  placeholder="クエリ ID"
                  className="mono"
                />
              </div>
              <div className="filter-bar audit-filter-row">
                <div className="audit-date-range">
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="開始日" />
                  <span className="rag-date-sep">〜</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="終了日" />
                </div>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => void load()}>絞り込み</button>
                <button type="button" className="btn btn-sm" onClick={() => void downloadCsv()}>CSV</button>
              </div>
            </div>
          </CollapsibleFilterPanel>

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
