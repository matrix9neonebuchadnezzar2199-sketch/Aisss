import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  apiFetch,
  fetchAdminDashboard,
  fetchJobStats,
  fetchRagStatus,
  type CaseListItem,
  type MasterItem
} from '../lib/api'
import { useSearchFilterCollapsed } from '../hooks/useSidebarCollapsed'

export function SearchPage () {
  const navigate = useNavigate()
  const [filterCollapsed, toggleFilter] = useSearchFilterCollapsed()
  const [items, setItems] = useState<CaseListItem[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [materialTypeId, setMaterialTypeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [rankId, setRankId] = useState('')
  const [viewingRangeId, setViewingRangeId] = useState('')
  const [materialTypes, setMaterialTypes] = useState<MasterItem[]>([])
  const [departments, setDepartments] = useState<MasterItem[]>([])
  const [ranks, setRanks] = useState<MasterItem[]>([])
  const [viewingRanges, setViewingRanges] = useState<MasterItem[]>([])
  const [stats, setStats] = useState({
    cases: 0,
    extractionPending: 0,
    embeddingPending: 0,
    failed: 0
  })

  useEffect(() => {
    void Promise.all([
      apiFetch<{ items: MasterItem[] }>('/api/masters/material-types'),
      apiFetch<{ items: MasterItem[] }>('/api/masters/departments'),
      apiFetch<{ items: MasterItem[] }>('/api/masters/rank-levels'),
      apiFetch<{ items: MasterItem[] }>('/api/masters/viewing-ranges'),
      fetchJobStats().catch(() => null),
      fetchRagStatus().catch(() => null),
      fetchAdminDashboard().catch(() => null)
    ]).then(([mt, dept, rank, vr, jobStats, ragStatus, dash]) => {
      setMaterialTypes(mt.items)
      setDepartments(dept.items)
      setRanks(rank.items)
      setViewingRanges(vr.items)
      setStats({
        cases: dash?.cases ?? 0,
        extractionPending: jobStats?.by_type?.extraction?.pending ?? jobStats?.pending ?? 0,
        embeddingPending: ragStatus?.embedding_pending ?? 0,
        failed: jobStats?.failed ?? 0
      })
    }).catch((e: Error) => setError(e.message))
  }, [])

  async function runSearch () {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (materialTypeId) params.set('material_type_id', materialTypeId)
      if (departmentId) params.set('registering_department_id', departmentId)
      if (rankId) params.set('rank_id', rankId)
      if (viewingRangeId) params.set('viewing_range_id', viewingRangeId)
      const data = await apiFetch<{ items: CaseListItem[]; total: number }>(
        `/api/cases?${params.toString()}`
      )
      setItems(data.items)
      setTotal(data.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void runSearch()
  }, [])

  function goJobs (status: string, jobType?: string) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (jobType) params.set('job_type', jobType)
    navigate(`/jobs?${params.toString()}`)
  }

  return (
    <section className="view active" id="view-search">
      <div className="stats">
        <div className="stat-card">
          <div className="num">{stats.cases.toLocaleString()}</div>
          <div className="lbl">登録ケース</div>
        </div>
        <button type="button" className="stat-card stat-link" title="ジョブ状態へ" onClick={() => goJobs('pending', 'extraction')}>
          <div className="num num-warning">{stats.extractionPending}</div>
          <div className="lbl">処理待ち抽出 →</div>
        </button>
        <button type="button" className="stat-card stat-link" title="ジョブ状態へ" onClick={() => goJobs('pending', 'embedding')}>
          <div className="num num-warning">{stats.embeddingPending}</div>
          <div className="lbl">RAG 同期待ち →</div>
        </button>
        <button type="button" className="stat-card stat-link" title="ジョブ状態へ" onClick={() => goJobs('failed')}>
          <div className="num num-danger">{stats.failed}</div>
          <div className="lbl">取り込みエラー →</div>
        </button>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>ケース（事象）検索</h2>
          <Link className="btn btn-primary btn-sm" to="/register">+ 新規登録</Link>
        </div>
        <div className="panel-body">
          <div className={`filter-panel${filterCollapsed ? ' collapsed' : ''}`} id="searchFilterPanel">
            <button
              type="button"
              className="filter-panel-toggle"
              aria-expanded={!filterCollapsed}
              onClick={toggleFilter}
            >
              <span className="filter-chevron">{filterCollapsed ? '▶' : '▼'}</span>
              <span>検索条件</span>
              <span className="filter-collapsed-hint">クリックで展開</span>
            </button>
            <div className="filter-panel-body" id="searchFilterBody">
              <div className="search-filter-panel">
                <div className="filter-bar search-filter-row search-filter-keyword">
                  <input
                    type="search"
                    placeholder="キーワード・全文検索…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <div className="filter-bar search-filter-row search-filter-masters">
                  <select title="資料区分" value={materialTypeId} onChange={(e) => setMaterialTypeId(e.target.value)}>
                    <option value="">資料区分</option>
                    {materialTypes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <select title="登録部署" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                    <option value="">登録部署</option>
                    {departments.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <select title="ランク" value={rankId} onChange={(e) => setRankId(e.target.value)}>
                    <option value="">ランク</option>
                    {ranks.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="filter-bar search-filter-row search-filter-viewing">
                  <select title="閲覧範囲" value={viewingRangeId} onChange={(e) => setViewingRangeId(e.target.value)}>
                    <option value="">閲覧範囲</option>
                    {viewingRanges.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="filter-bar search-filter-row search-filter-actions">
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => void runSearch()} disabled={loading}>
                    検索
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p className="search-hint">
            表題クリックでケース詳細を表示。2件比較は <strong>Ctrl+クリック</strong>（Mac: <strong>⌘+クリック</strong>）で別タブ、または詳細画面の「別タブで開く」を使用。
          </p>

          {error && <p className="error">{error}</p>}
          <p className="meta">{total} 件</p>

          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">表示 ID</th>
                <th scope="col">表題</th>
                <th scope="col">資料区分</th>
                <th scope="col">部署</th>
                <th scope="col">ランク</th>
                <th scope="col">更新日</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="mono">
                    <Link to={`/cases/${row.display_id}`} target="_blank" rel="noopener noreferrer">
                      {row.display_id}
                    </Link>
                  </td>
                  <td>
                    <Link to={`/cases/${row.display_id}`} target="_blank" rel="noopener noreferrer">
                      {row.title}
                    </Link>
                  </td>
                  <td>{row.material_type_name ?? '—'}</td>
                  <td>{row.department_name ?? '—'}</td>
                  <td>{row.rank_name ?? '—'}</td>
                  <td className="mono">{row.updated_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
