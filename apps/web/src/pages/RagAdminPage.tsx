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
  const [status, setStatus] = useState({
    chunk_count: 0,
    embedding_pending: 0,
    pipeline_failed: 0,
    vectors_synced: 0,
    not_enabled_candidates: 0,
    auto_enable_reserved: 0
  })
  const [items, setItems] = useState<RagFileItem[]>([])
  const [q, setQ] = useState('')
  const [viewingRangeId, setViewingRangeId] = useState('')
  const [candidatesOnly, setCandidatesOnly] = useState(false)
  const [viewingRanges, setViewingRanges] = useState<MasterItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, boolean>>({})

  async function reload () {
    const [s, f] = await Promise.all([
      fetchRagStatus(),
      fetchRagFiles({
        ...(q ? { q } : {}),
        ...(viewingRangeId ? { viewing_range_id: viewingRangeId } : {}),
        ...(candidatesOnly ? { knowledge_candidates_only: 'true' } : {})
      })
    ])
    setStatus(s)
    setItems(f.items)
  }

  useEffect(() => {
    void apiFetch<{ items: MasterItem[] }>('/api/masters/viewing-ranges')
      .then((d) => setViewingRanges(d.items))
      .catch((e: Error) => setError(e.message))
  }, [])

  // フィルタ checkbox の変更は即座に一覧へ反映する
  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatesOnly])

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

  async function retryFailedExtraction (itemId: string) {
    try {
      await retryExtraction(itemId)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '再抽出の開始に失敗しました')
    }
  }

  // 初回有効化は「抽出成功済み」が条件（chunk はまだ無いので pipeline ready を要求するとデッドロックする）。
  // 無効化はいつでも可能にする。
  function ragToggleDisabled (item: RagFileItem): boolean {
    if (pending[item.id]) return true
    if (item.rag_enabled) return false
    return item.extraction_status !== 'succeeded'
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
        <span className={status.not_enabled_candidates > 0 ? 'stat-warn' : ''}>
          未ナレッジ化候補: {status.not_enabled_candidates}
        </span>
        <span>自動ON予約: {status.auto_enable_reserved}</span>
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
        <label className="inline-check">
          <input
            type="checkbox"
            checked={candidatesOnly}
            onChange={(e) => setCandidatesOnly(e.target.checked)}
          />
          未ナレッジ化候補のみ
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
            <th>状態</th>
            <th>自動ON予約</th>
            <th>㋹ RAG</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={`${item.source_kind}-${item.id}`}
              className={item.is_knowledge_candidate ? 'rag-row-candidate' : undefined}
            >
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
                <span className={`rag-visibility rag-visibility-${item.rag_visibility_state}`}>
                  {item.rag_visibility_label}
                </span>
              </td>
              <td>{item.auto_enable_rag_on_extraction ? 'ON' : '—'}</td>
              <td>
                <input
                  type="checkbox"
                  checked={item.rag_enabled}
                  disabled={ragToggleDisabled(item)}
                  onChange={() => void toggleRag(item)}
                />
              </td>
              <td>
                {item.extraction_status === 'failed' && item.source_kind === 'case_attachment' && (
                  <button type="button" className="linkish" onClick={() => void retryFailedExtraction(item.id)}>
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
