import { useEffect, useState } from 'react'
import { apiFetch, type MasterItem } from '../lib/api'

const MASTER_OPTIONS = [
  { key: 'material-types', label: '資料区分' },
  { key: 'departments', label: '登録部署' },
  { key: 'rank-levels', label: 'ランク' },
  { key: 'viewing-ranges', label: '閲覧範囲' }
]

export function MastersPage () {
  const [master, setMaster] = useState('material-types')
  const [items, setItems] = useState<MasterItem[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load () {
    setError(null)
    try {
      const data = await apiFetch<{ items: MasterItem[] }>(`/api/masters/${master}`)
      setItems(data.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    }
  }

  useEffect(() => {
    void load()
  }, [master])

  async function addValue () {
    if (!newName.trim()) return
    setError(null)
    try {
      await apiFetch(`/api/masters/${master}`, {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() })
      })
      setNewName('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'マスタ値の追加に失敗しました')
    }
  }

  const masterLabel = MASTER_OPTIONS.find((m) => m.key === master)?.label ?? master

  return (
    <section className="view active" id="view-masters">
      <div className="panel">
        <div className="panel-header">
          <h2>マスタ管理</h2>
          <select value={master} onChange={(e) => setMaster(e.target.value)}>
            {MASTER_OPTIONS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <div className="panel-body">
          {error && <p className="error">{error}</p>}

          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">名称</th>
                <th scope="col">ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className="mono">{item.id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="filter-bar" style={{ marginTop: 12 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`${masterLabel} に追加する値`}
            />
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void addValue()}>+ 値を追加</button>
          </div>
        </div>
      </div>
    </section>
  )
}
