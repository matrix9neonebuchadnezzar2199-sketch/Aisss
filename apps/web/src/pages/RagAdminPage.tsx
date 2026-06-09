import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  apiFetch,
  fetchRagFiles,
  fetchRagStatus,
  retryExtraction,
  setRagEnabled,
  type MasterItem,
  type RagFileItem
} from '../lib/api'

export function RagAdminPage () {
  const [status, setStatus] = useState({ chunk_count: 0, embedding_pending: 0, pipeline_failed: 0, vectors_synced: 0 })
  const [items, setItems] = useState<RagFileItem[]>([])
  const [q, setQ] = useState('')
  const [viewingRangeId, setViewingRangeId] = useState('')
  const [viewingRanges, setViewingRanges] = useState<MasterItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, boolean>>({})

  async function reload () {
    const [s, f] = await Promise.all([
      fetchRagStatus(),
      fetchRagFiles({
        ...(q ? { q } : {}),
        ...(viewingRangeId ? { viewing_range_id: viewingRangeId } : {})
      })
    ])
    setStatus(s)
    setItems(f.items)
  }

  useEffect(() => {
    void apiFetch<{ items: MasterItem[] }>('/api/masters/viewing-ranges')
      .then((d) => setViewingRanges(d.items))
      .catch((e: Error) => setError(e.message))
    void reload().catch((e: Error) => setError(e.message))
  }, [])

  async function toggleRag (item: RagFileItem) {
    setPending((p) => ({ ...p, [item.id]: true }))
    try {
      await setRagEnabled(item.id, !item.rag_enabled, item.source_kind)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setPending((p) => ({ ...p, [item.id]: false }))
    }
  }

  return (
    <section className="page">
      <div className="detail-header">
        <h2>RAG 管理</h2>
        <Link to="/rag/standalone" className="primary">+ 単独ファイル登録</Link>
      </div>

      <div className="stats-row">
        <span>チャンク: {status.chunk_count}</span>
        <span>埋め込み待ち: {status.embedding_pending}</span>
        <span>失敗: {status.pipeline_failed}</span>
        <span>同期済み: {status.vectors_synced}</span>
      </div>

      <div className="filter-panel">
        <label>タイトル検索
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>閲覧範囲
          <select value={viewingRangeId} onChange={(e) => setViewingRangeId(e.target.value)}>
            <option value="">すべて</option>
            {viewingRanges.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void reload()}>再読み込み</button>
      </div>

      {error && <p className="error">{error}</p>}

      <table className="data-table">
        <thead>
          <tr>
            <th>ファイル</th>
            <th>種別</th>
            <th>閲覧範囲</th>
            <th>パイプライン</th>
            <th>㋹ RAG</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.source_kind}-${item.id}`}>
              <td>{item.file_name}</td>
              <td>{item.source_kind === 'case_attachment' ? 'ケース添付' : '単独'}</td>
              <td>
                {item.viewing_range_labels.join(', ')}
                {item.source_kind === 'case_attachment' && item.case_display_id && (
                  <Link to={`/register?edit=${item.case_display_id}`} className="badge">ケース継承</Link>
                )}
              </td>
              <td><span className={`status status-${item.extraction_status}`}>{item.pipeline_status}</span></td>
              <td>
                <input
                  type="checkbox"
                  checked={item.rag_enabled}
                  disabled={pending[item.id] || item.pipeline_status !== 'ready'}
                  onChange={() => void toggleRag(item)}
                />
              </td>
              <td>
                {item.extraction_status === 'failed' && item.source_kind === 'case_attachment' && (
                  <button type="button" className="linkish" onClick={() => void retryExtraction(item.id).then(reload)}>
                    再抽出
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
