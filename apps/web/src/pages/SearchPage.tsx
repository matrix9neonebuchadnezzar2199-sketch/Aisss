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
import { CollapsibleFilterPanel } from '../components/layout/CollapsibleFilterPanel'

type SearchFilters = {
  q: string
  title: string
  material_number: string
  material_type_id: string
  registering_department_id: string
  rank_id: string
  viewing_range_id: string
  category_id: string
  region_id: string
  source_id: string
  information_request_id: string
  handling_type_id: string
  reliability_id: string
  accuracy_id: string
  condition_id: string
  event_date_from: string
  event_date_to: string
}

const emptyFilters: SearchFilters = {
  q: '',
  title: '',
  material_number: '',
  material_type_id: '',
  registering_department_id: '',
  rank_id: '',
  viewing_range_id: '',
  category_id: '',
  region_id: '',
  source_id: '',
  information_request_id: '',
  handling_type_id: '',
  reliability_id: '',
  accuracy_id: '',
  condition_id: '',
  event_date_from: '',
  event_date_to: ''
}

export function SearchPage () {
  const navigate = useNavigate()
  const [items, setItems] = useState<CaseListItem[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters)
  const [masters, setMasters] = useState<Record<string, MasterItem[]>>({})
  const [stats, setStats] = useState({
    cases: 0,
    extractionPending: 0,
    embeddingPending: 0,
    failed: 0
  })

  useEffect(() => {
    const masterPaths = [
      'material-types', 'departments', 'rank-levels', 'viewing-ranges',
      'categories', 'regions', 'sources', 'information-requests',
      'handling-types', 'reliability-levels', 'accuracy-levels', 'conditions'
    ]
    void Promise.all([
      ...masterPaths.map((p) =>
        apiFetch<{ items: MasterItem[] }>(`/api/masters/${p}`).then((d) => [p, d.items] as const)
      ),
      fetchJobStats().catch(() => null),
      fetchRagStatus().catch(() => null),
      fetchAdminDashboard().catch(() => null)
    ]).then((results) => {
      const masterEntries = results.slice(0, masterPaths.length) as Array<[string, MasterItem[]]>
      setMasters(Object.fromEntries(masterEntries))
      const jobStats = results[masterPaths.length] as Awaited<ReturnType<typeof fetchJobStats>> | null
      const ragStatus = results[masterPaths.length + 1] as Awaited<ReturnType<typeof fetchRagStatus>> | null
      const dash = results[masterPaths.length + 2] as Awaited<ReturnType<typeof fetchAdminDashboard>> | null
      setStats({
        cases: dash?.cases ?? 0,
        extractionPending: jobStats?.by_type?.extraction?.pending ?? jobStats?.pending ?? 0,
        embeddingPending: ragStatus?.embedding_pending ?? 0,
        failed: jobStats?.failed ?? 0
      })
    }).catch((e: Error) => setError(e.message))
  }, [])

  function setFilter<K extends keyof SearchFilters> (key: K, value: SearchFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  async function runSearch () {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(filters)) {
        if (value?.trim()) params.set(key, value.trim())
      }
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

  const m = (key: string) => masters[key] ?? []

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
          <CollapsibleFilterPanel storageKey="aisss-search-filter-collapsed" title="検索条件">
            <div className="search-filter-panel">
              <div className="filter-bar search-filter-row search-filter-keyword">
                <input type="search" placeholder="キーワード・全文検索…" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} />
                <input type="search" placeholder="表題" value={filters.title} onChange={(e) => setFilter('title', e.target.value)} />
                <input type="search" placeholder="資料番号" value={filters.material_number} onChange={(e) => setFilter('material_number', e.target.value)} />
              </div>
              <div className="filter-bar search-filter-row search-filter-masters">
                <select title="資料区分" value={filters.material_type_id} onChange={(e) => setFilter('material_type_id', e.target.value)}>
                  <option value="">資料区分</option>
                  {m('material-types').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <select title="登録部署" value={filters.registering_department_id} onChange={(e) => setFilter('registering_department_id', e.target.value)}>
                  <option value="">登録部署</option>
                  {m('departments').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <select title="ランク" value={filters.rank_id} onChange={(e) => setFilter('rank_id', e.target.value)}>
                  <option value="">ランク</option>
                  {m('rank-levels').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <select title="分類" value={filters.category_id} onChange={(e) => setFilter('category_id', e.target.value)}>
                  <option value="">分類</option>
                  {m('categories').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <select title="地域" value={filters.region_id} onChange={(e) => setFilter('region_id', e.target.value)}>
                  <option value="">地域</option>
                  {m('regions').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div className="filter-bar search-filter-row search-filter-masters">
                <select title="資料源" value={filters.source_id} onChange={(e) => setFilter('source_id', e.target.value)}>
                  <option value="">資料源</option>
                  {m('sources').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <select title="対応情報要求" value={filters.information_request_id} onChange={(e) => setFilter('information_request_id', e.target.value)}>
                  <option value="">対応情報要求</option>
                  {m('information-requests').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <select title="取扱区分" value={filters.handling_type_id} onChange={(e) => setFilter('handling_type_id', e.target.value)}>
                  <option value="">取扱区分</option>
                  {m('handling-types').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <select title="信頼性" value={filters.reliability_id} onChange={(e) => setFilter('reliability_id', e.target.value)}>
                  <option value="">信頼性</option>
                  {m('reliability-levels').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <select title="正確性" value={filters.accuracy_id} onChange={(e) => setFilter('accuracy_id', e.target.value)}>
                  <option value="">正確性</option>
                  {m('accuracy-levels').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div className="filter-bar search-filter-row search-filter-viewing">
                <select title="閲覧範囲" value={filters.viewing_range_id} onChange={(e) => setFilter('viewing_range_id', e.target.value)}>
                  <option value="">閲覧範囲</option>
                  {m('viewing-ranges').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <select title="条件" value={filters.condition_id} onChange={(e) => setFilter('condition_id', e.target.value)}>
                  <option value="">条件</option>
                  {m('conditions').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <label className="search-date-label">
                  事象開始
                  <input type="date" value={filters.event_date_from} onChange={(e) => setFilter('event_date_from', e.target.value)} />
                </label>
                <label className="search-date-label">
                  事象終了
                  <input type="date" value={filters.event_date_to} onChange={(e) => setFilter('event_date_to', e.target.value)} />
                </label>
              </div>
              <div className="filter-bar search-filter-row search-filter-actions">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => void runSearch()} disabled={loading}>検索</button>
              </div>
            </div>
          </CollapsibleFilterPanel>

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
                    <Link to={`/cases/${row.display_id}`} target="_blank" rel="noopener noreferrer">{row.display_id}</Link>
                  </td>
                  <td>
                    <Link to={`/cases/${row.display_id}`} target="_blank" rel="noopener noreferrer">{row.title}</Link>
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
