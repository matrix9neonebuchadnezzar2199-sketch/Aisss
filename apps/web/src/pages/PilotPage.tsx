import { useEffect, useState } from 'react'
import {
  createPilotFeedback,
  fetchPilotFeedback,
  updatePilotFeedbackStatus,
  type PilotFeedback
} from '../lib/api'

export function PilotPage () {
  const [items, setItems] = useState<PilotFeedback[]>([])
  const [area, setArea] = useState('case')
  const [severity, setSeverity] = useState('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load () {
    const data = await fetchPilotFeedback()
    setItems(data.items)
  }

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message))
  }, [])

  async function submit () {
    setError(null)
    try {
      await createPilotFeedback({ area, severity, title, description })
      setTitle('')
      setDescription('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'feedback failed')
    }
  }

  async function setStatus (id: string, status: string) {
    await updatePilotFeedbackStatus(id, status)
    await load()
  }

  return (
    <section className="page">
      <h2>本番パイロット</h2>
      <p className="meta">パイロット feedback を収集し、M7 から Post-MVP backlog へ整理します。</p>

      <div className="filter-panel">
        <label>領域
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="case">ケース</option>
            <option value="rag">RAG / AI</option>
            <option value="permission">権限</option>
            <option value="ops">運用</option>
          </select>
        </label>
        <label>重要度
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
        <label>タイトル
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>内容
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button type="button" onClick={() => void submit()}>登録</button>
      </div>

      {error && <p className="error">{error}</p>}

      <table className="data-table">
        <thead>
          <tr><th>作成</th><th>領域</th><th>重要度</th><th>タイトル</th><th>状態</th><th>操作</th></tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.created_at?.slice(0, 10)}</td>
              <td>{item.area}</td>
              <td>{item.severity}</td>
              <td>{item.title}</td>
              <td>{item.status}</td>
              <td>
                {item.status !== 'triaged' && (
                  <button type="button" className="linkish" onClick={() => void setStatus(item.id, 'triaged')}>triage</button>
                )}
                {item.status !== 'closed' && (
                  <button type="button" className="linkish" onClick={() => void setStatus(item.id, 'closed')}>close</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
