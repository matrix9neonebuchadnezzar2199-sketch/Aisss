import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  apiFetch,
  bulkReindexRag,
  deleteRagFile,
  fetchRagFiles,
  fetchRagStatus,
  fetchRagTree,
  retryExtraction,
  setRagEnabled,
  updateStandaloneViewingRanges,
  type MasterItem,
  type RagFileItem,
  type RagStorageBreakdown,
  type RagTreeFile,
  type RagTreeGenre
} from '../lib/api'
import { RagStorageDashboard } from '../components/rag/RagStorageDashboard'
import { RagTreePanel } from '../components/rag/RagTreePanel'
import { RagStatusMark } from '../components/rag/RagStatusMark'
import { RagDeleteDialog } from '../components/rag/RagDeleteDialog'
import { RagCaseViewingDialog } from '../components/rag/RagCaseViewingDialog'
import { ragRowClassName } from '../components/rag/rag-status-visual'
import {
  filterItemsByTreeSelection,
  ragToggleDisabled,
  type RagTreeSelection
} from '../components/rag/rag-tree-utils'
import {
  sortRagFileItems,
  type RagSortKey,
  type SortDirection
} from '../components/rag/rag-file-sort'
import { CollapsibleFilterPanel } from '../components/layout/CollapsibleFilterPanel'

const SORTABLE_COLUMNS: Array<{ key: RagSortKey; label: string; type?: string }> = [
  { key: 'file_name', label: 'ファイル' },
  { key: 'viewing_range', label: '閲覧範囲' },
  { key: 'pipeline', label: 'パイプライン' },
  { key: 'rag_enabled', label: '㋹ RAG', type: 'checkbox' }
]

export function RagAdminPage () {
  const navigate = useNavigate()
  const [status, setStatus] = useState({
    chunk_count: 0,
    embedding_pending: 0,
    pipeline_failed: 0,
    vectors_synced: 0,
    not_enabled_candidates: 0,
    auto_enable_reserved: 0,
    storage_breakdown: {
      total_bytes: 0,
      total_files: 0,
      total_chunks: 0,
      categories: []
    } as RagStorageBreakdown
  })
  const [items, setItems] = useState<RagFileItem[]>([])
  const [treeGenres, setTreeGenres] = useState<RagTreeGenre[]>([])
  const [treeSelection, setTreeSelection] = useState<RagTreeSelection>({ level: 'genre', genreId: 'case' })
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewingRangeId, setViewingRangeId] = useState('')
  const [candidatesOnly, setCandidatesOnly] = useState(false)
  const [viewingRanges, setViewingRanges] = useState<MasterItem[]>([])
  const [sortKey, setSortKey] = useState<RagSortKey>('file_name')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [deleteTarget, setDeleteTarget] = useState<RagFileItem | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [caseViewingTarget, setCaseViewingTarget] = useState<RagFileItem | null>(null)
  const [bulkReindexPending, setBulkReindexPending] = useState(false)
  const [viewingRangeDraft, setViewingRangeDraft] = useState<Record<string, string>>({})

  async function reload () {
    const params: Record<string, string> = {}
    if (q) params.q = q
    if (tag) params.tag = tag
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (viewingRangeId) params.viewing_range_id = viewingRangeId
    if (candidatesOnly) params.knowledge_candidates_only = 'true'

    const [s, f, tree] = await Promise.all([
      fetchRagStatus(),
      fetchRagFiles(params),
      fetchRagTree()
    ])
    setStatus(s)
    setItems(f.items)
    setTreeGenres(tree.genres)
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

  const filteredItems = useMemo(() => {
    const treeFiltered = filterItemsByTreeSelection(items, treeSelection)
    return sortRagFileItems(treeFiltered, sortKey, sortDir)
  }, [items, treeSelection, sortKey, sortDir])

  async function setFileRag (file: RagFileItem | RagTreeFile, enabled: boolean) {
    const sourceKind = file.source_kind
    setPending((p) => ({ ...p, [file.id]: true }))
    try {
      await setRagEnabled(file.id, enabled, sourceKind)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setPending((p) => ({ ...p, [file.id]: false }))
    }
  }

  async function toggleRag (item: RagFileItem) {
    await setFileRag(item, !item.rag_enabled)
  }

  async function retryFailedExtraction (itemId: string) {
    try {
      await retryExtraction(itemId)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '再抽出の開始に失敗しました')
    }
  }

  async function confirmDelete () {
    if (!deleteTarget) return
    setDeletePending(true)
    setError(null)
    try {
      await deleteRagFile(deleteTarget)
      setDeleteTarget(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました')
    } finally {
      setDeletePending(false)
    }
  }

  async function saveStandaloneViewingRange (item: RagFileItem, viewingRangeIdValue: string) {
    if (!viewingRangeIdValue) return
    setPending((p) => ({ ...p, [item.id]: true }))
    try {
      await updateStandaloneViewingRanges(item.id, [viewingRangeIdValue])
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '閲覧範囲の更新に失敗しました')
    } finally {
      setPending((p) => ({ ...p, [item.id]: false }))
    }
  }

  async function runBulkReindex () {
    setBulkReindexPending(true)
    setError(null)
    try {
      const result = await bulkReindexRag()
      await reload()
      setError(null)
      // 成功フィードバックは件数表示で十分（error チャネルは使わない）
      void result
    } catch (e) {
      setError(e instanceof Error ? e.message : '一括再インデックスに失敗しました')
    } finally {
      setBulkReindexPending(false)
    }
  }

  function toggleSort (key: RagSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  function isRagToggleDisabled (item: RagFileItem): boolean {
    return ragToggleDisabled(item, pending[item.id] ?? false)
  }

  function standaloneViewingValue (item: RagFileItem): string {
    return viewingRangeDraft[item.id] ?? item.viewing_range_ids[0] ?? ''
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

      <RagStorageDashboard breakdown={status.storage_breakdown} />

      <div className="panel">
        <div className="panel-header">
          <h2>RAG 管理</h2>
          <Link className="btn btn-primary btn-sm" to="/rag/standalone">+ 単独ファイル登録</Link>
          <button
            type="button"
            className="btn btn-sm"
            disabled={bulkReindexPending}
            onClick={() => void runBulkReindex()}
          >
            {bulkReindexPending ? '投入中…' : '一括再インデックス'}
          </button>
        </div>
        <div className="panel-body">
          <p className="rag-register-note">
            <strong>ファイルの登録方法:</strong>
            ① <strong>ケース添付</strong> — 登録 → ケース（事象）でファイルを添付。
            ② <strong>単独ファイル</strong> — 本画面の「+ 単独ファイル登録」。
            いずれも左の「RAGの体系管理」に表示され、ここで抽出状態の確認と RAG 有効化を行います。
          </p>

          <div className="rag-layout">
            <RagTreePanel
              genres={treeGenres}
              pending={pending}
              selection={treeSelection}
              onSelect={setTreeSelection}
              onSetFileRag={(file, enabled) => void setFileRag(file, enabled)}
            />

            <div className="rag-main">
              <p className="rag-register-note" style={{ marginBottom: 8 }}>
                ㋹ = AI 検索のベクトル索引に含める。列見出しクリックでソート。ケース添付の閲覧範囲はケース側で変更、単独ファイルは一覧から編集できます。
              </p>

              <CollapsibleFilterPanel storageKey="aisss-rag-filter-collapsed" title="絞り込み条件">
                <div className="search-filter-panel">
                  <div className="filter-bar search-filter-row search-filter-keyword">
                    <label className="filter-inline-label">
                      タイトル検索
                      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ファイル名…" />
                    </label>
                    <label className="filter-inline-label">
                      タグ
                      <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="タグ（完全一致）" />
                    </label>
                  </div>
                  <div className="filter-bar search-filter-row">
                    <label className="filter-inline-label">
                      期間（開始）
                      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </label>
                    <label className="filter-inline-label">
                      期間（終了）
                      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </label>
                  </div>
                  <div className="filter-bar search-filter-row search-filter-viewing">
                    <label className="filter-inline-label">
                      閲覧範囲
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
                  </div>
                  <div className="filter-bar search-filter-row search-filter-actions">
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => void reload()}>検索</button>
                    {treeSelection.level !== 'all' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setTreeSelection({ level: 'all' })}
                      >
                        ツリー選択を解除
                      </button>
                    )}
                  </div>
                </div>
              </CollapsibleFilterPanel>

              {error && <p className="error">{error}</p>}
              <p className="meta">{filteredItems.length} 件</p>

              <table className="data-table">
                <thead>
                  <tr>
                    {SORTABLE_COLUMNS.map((col) => (
                      <th key={col.key} scope="col">
                        <button
                          type="button"
                          className={`sortable-th${sortKey === col.key ? ` sort-${sortDir}` : ''}`}
                          onClick={() => toggleSort(col.key)}
                          aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          {col.label}
                          <span className="sort-ind" aria-hidden="true" />
                        </button>
                      </th>
                    ))}
                    <th scope="col">状態</th>
                    <th scope="col">自動ON予約</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr
                      key={`${item.source_kind}-${item.id}`}
                      className={ragRowClassName(item.rag_visibility_state, item.is_knowledge_candidate)}
                    >
                      <td>
                        <span className="rag-file-name-cell">
                          <RagStatusMark state={item.rag_visibility_state} label={item.rag_visibility_label} variant="table" />
                          {item.title} / {item.file_name}
                        </span>
                        {item.tags && item.tags.length > 0 && (
                          <span className="meta"> — {item.tags.join(', ')}</span>
                        )}
                      </td>
                      <td>
                        {item.editable_viewing_range ? (
                          <select
                            className="rag-viewing-select"
                            value={standaloneViewingValue(item)}
                            disabled={pending[item.id]}
                            onChange={(e) => {
                              const value = e.target.value
                              setViewingRangeDraft((d) => ({ ...d, [item.id]: value }))
                              void saveStandaloneViewingRange(item, value)
                            }}
                          >
                            {viewingRanges.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            className="rag-viewing-readonly"
                            onClick={() => setCaseViewingTarget(item)}
                          >
                            {item.viewing_range_labels.join(', ')}
                            {' '}
                            <span className="label label-purple rag-viewing-inherit">ケース継承</span>
                          </button>
                        )}
                      </td>
                      <td><span className={`status status-${item.extraction_status}`}>{item.pipeline_status}</span></td>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.rag_enabled}
                          disabled={isRagToggleDisabled(item)}
                          onChange={() => void toggleRag(item)}
                          title="㋹ RAG 有効化"
                          data-rag-file-id={item.id}
                        />
                      </td>
                      <td>
                        <span className={`rag-visibility rag-visibility-${item.rag_visibility_state}`}>
                          {item.rag_visibility_label}
                        </span>
                      </td>
                      <td>
                        <span className={item.auto_enable_rag_on_extraction ? 'rag-auto-on-reserved' : 'rag-auto-on-off'}>
                          {item.auto_enable_rag_on_extraction ? 'ON' : '—'}
                        </span>
                      </td>
                      <td>
                        {item.extraction_status === 'failed' && item.source_kind === 'case_attachment' && (
                          <button type="button" className="btn btn-sm" onClick={() => void retryFailedExtraction(item.id)}>
                            再抽出
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => setDeleteTarget(item)}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <RagDeleteDialog
        open={deleteTarget !== null}
        targetLabel={deleteTarget ? `${deleteTarget.title} / ${deleteTarget.file_name}` : ''}
        pending={deletePending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <RagCaseViewingDialog
        open={caseViewingTarget !== null}
        targetLabel={caseViewingTarget ? `${caseViewingTarget.title} / ${caseViewingTarget.file_name}` : ''}
        caseDisplayId={caseViewingTarget?.case_display_id ?? null}
        onClose={() => setCaseViewingTarget(null)}
        onOpenCase={() => {
          if (caseViewingTarget?.case_display_id) {
            navigate(`/register?edit=${encodeURIComponent(caseViewingTarget.case_display_id)}`)
          }
          setCaseViewingTarget(null)
        }}
      />
    </section>
  )
}
