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
    await apiFetch(`/api/masters/${master}`, {
      method: 'POST',
      body: JSON.stringify({ name: newName.trim() })
    })
    setNewName('')
    await load()
  }

  return (
    <section className="page">
      <h2>マスタ管理</h2>
      <label>マスタ種別
        <select value={master} onChange={(e) => setMaster(e.target.value)}>
          {MASTER_OPTIONS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      <ul className="master-list">
        {items.map((item) => <li key={item.id}>{item.name}</li>)}
      </ul>
      <div className="inline-form">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="新しい値" />
        <button type="button" onClick={() => void addValue()}>+ 値を追加</button>
      </div>
    </section>
  )
}
