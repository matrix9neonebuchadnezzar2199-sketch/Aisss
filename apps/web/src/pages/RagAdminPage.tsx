import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
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

  function ragToggleDisabled (item: RagFileItem): boolean {
    if (pending[item.id]) return true
    if (item.rag_enabled) return false
    return item.extraction_status !== 'succeeded'
  }

  return (
    <section className="view active" id="view-rag-admin">
      <div className="stats">
        <div className="stat-card">
          <div className="num">{status.chunk_count}</div>
          <div className="lbl">チャンク</div>
        </div>
        <button type="button" className="stat-card stat-link" onClick={() => navigate('/jobs?status=pending&job_type=embedding')}>
          <div className="num num-warning">{status.embedding_pending}</div>
          <div className="lbl">埋め込み待ち →</div>
        </button>
        <button type="button" className="stat-card stat-link" onClick={() => navigate('/jobs?status=failed')}>
          <div className="num num-danger">{status.pipeline_failed}</div>
          <div className="lbl">パイプライン失敗 →</div>
        </button>
        <div className="stat-card">
          <div className="num">{status.vectors_synced}</div>
          <div className="lbl">同期済み</div>
        </div>
        <div className={`stat-card${status.not_enabled_candidates > 0 ? ' stat-warn' : ''}`}>
          <div className="num">{status.not_enabled_candidates}</div>
          <div className="lbl">未ナレッジ化候補</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>RAG 管理</h2>
          <Link className="btn btn-primary btn-sm" to="/rag/standalone">+ 単独ファイル登録</Link>
        </div>
        <div className="panel-body">
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
            <button type="button" className="btn btn-sm" onClick={() => void reload()}>再読み込み</button>
          </div>

          {error && <p className="error">{error}</p>}

          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">ファイル</th>
                <th scope="col">種別</th>
                <th scope="col">閲覧範囲</th>
                <th scope="col">パイプライン</th>
                <th scope="col">状態</th>
                <th scope="col">自動ON予約</th>
                <th scope="col">㋹ RAG</th>
                <th scope="col">操作</th>
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
                      <>
                        {' '}
                        <Link
                          to={`/register?edit=${encodeURIComponent(item.case_display_id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="label label-info"
                        >
                          ケースを開く
                        </Link>
                      </>
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
                      title="㋹ RAG 有効化"
                    />
                  </td>
                  <td>
                    {item.extraction_status === 'failed' && item.source_kind === 'case_attachment' && (
                      <button type="button" className="btn btn-sm" onClick={() => void retryFailedExtraction(item.id)}>
                        再抽出
                      </button>
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
