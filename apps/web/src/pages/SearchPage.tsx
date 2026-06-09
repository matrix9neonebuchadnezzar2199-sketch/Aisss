import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, type CaseListItem, type MasterItem } from '../lib/api'

export function SearchPage () {
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

  useEffect(() => {
    void Promise.all([
      apiFetch<{ items: MasterItem[] }>('/api/masters/material-types'),
      apiFetch<{ items: MasterItem[] }>('/api/masters/departments'),
      apiFetch<{ items: MasterItem[] }>('/api/masters/rank-levels'),
      apiFetch<{ items: MasterItem[] }>('/api/masters/viewing-ranges')
    ]).then(([mt, dept, rank, vr]) => {
      setMaterialTypes(mt.items)
      setDepartments(dept.items)
      setRanks(rank.items)
      setViewingRanges(vr.items)
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

  return (
    <section className="page">
      <h2>ケース検索</h2>
      <div className="filter-panel search-filter-panel">
        <div className="search-filter-keyword">
          <label>キーワード・全文検索</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="キーワード" />
        </div>
        <div className="search-filter-masters">
          <label>資料区分
            <select value={materialTypeId} onChange={(e) => setMaterialTypeId(e.target.value)}>
              <option value="">すべて</option>
              {materialTypes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label>登録部署
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">すべて</option>
              {departments.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label>ランク
            <select value={rankId} onChange={(e) => setRankId(e.target.value)}>
              <option value="">すべて</option>
              {ranks.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        </div>
        <div className="search-filter-viewing">
          <label>閲覧範囲
            <select value={viewingRangeId} onChange={(e) => setViewingRangeId(e.target.value)}>
              <option value="">すべて</option>
              {viewingRanges.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        </div>
        <div className="search-filter-actions">
          <button type="button" onClick={() => void runSearch()} disabled={loading}>検索</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      <p className="meta">{total} 件</p>

      <table className="data-table">
        <thead>
          <tr>
            <th>表示 ID</th>
            <th>表題</th>
            <th>資料区分</th>
            <th>部署</th>
            <th>ランク</th>
            <th>更新日</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td><Link to={`/cases/${row.display_id}`}>{row.display_id}</Link></td>
              <td>{row.title}</td>
              <td>{row.material_type_name ?? '—'}</td>
              <td>{row.department_name ?? '—'}</td>
              <td>{row.rank_name ?? '—'}</td>
              <td>{row.updated_at?.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
