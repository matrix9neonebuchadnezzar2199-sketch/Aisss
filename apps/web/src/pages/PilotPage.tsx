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
  const [notice, setNotice] = useState<string | null>(null)
  const [listRestricted, setListRestricted] = useState(false)

  async function load () {
    try {
      const data = await fetchPilotFeedback()
      setItems(data.items)
      setListRestricted(false)
    } catch {
      setListRestricted(true)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function submit () {
    setError(null)
    setNotice(null)
    try {
      await createPilotFeedback({ area, severity, title, description })
      setTitle('')
      setDescription('')
      setNotice('フィードバックを登録しました')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'feedback failed')
    }
  }

  async function setStatus (id: string, status: string) {
    try {
      await updatePilotFeedbackStatus(id, status)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ステータス更新に失敗しました')
    }
  }

  return (
    <section className="view active" id="view-pilot">
      <div className="panel">
        <div className="panel-header">
          <h2>本番パイロット</h2>
          <span className="label label-info">M7 feedback</span>
        </div>
        <div className="panel-body">
          <p className="rag-register-note">パイロット feedback を収集し、M7 から Post-MVP backlog へ整理します。</p>

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
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void submit()}>登録</button>
          </div>

          {error && <p className="error">{error}</p>}
          {notice && <p className="meta">{notice}</p>}
          {listRestricted && (
            <p className="rag-register-note">フィードバック一覧の閲覧には運用者権限が必要です（登録は可能です）。</p>
          )}

          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">作成</th>
                <th scope="col">領域</th>
                <th scope="col">重要度</th>
                <th scope="col">タイトル</th>
                <th scope="col">状態</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="mono">{item.created_at?.slice(0, 10)}</td>
                  <td>{item.area}</td>
                  <td>{item.severity}</td>
                  <td>{item.title}</td>
                  <td>{item.status}</td>
                  <td>
                    {item.status !== 'triaged' && (
                      <button type="button" className="btn btn-sm" onClick={() => void setStatus(item.id, 'triaged')}>triage</button>
                    )}
                    {item.status !== 'closed' && (
                      <button type="button" className="btn btn-sm" onClick={() => void setStatus(item.id, 'closed')}>close</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
