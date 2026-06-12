import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteOllamaModelFromHost,
  fetchOllamaHealth,
  fetchOllamaInferenceStatus,
  fetchOllamaModels,
  fetchReindexStatus,
  INFERENCE_CHAT_ROLE_BLOCK_MESSAGE,
  saveModelRoles,
  startReindex,
  type ModelCapabilityTag,
  type OllamaModelsResponse,
  type ReindexJobStatus
} from '../lib/api'
import { ModelDeleteDialog } from '../components/models/ModelDeleteDialog'
import { ReindexConfirmDialog } from '../components/models/ReindexConfirmDialog'

type ModelRow = {
  name: string
  model_id: string
  size_bytes: number
  modified_at: string
  digest: string | null
  details: OllamaModelsResponse['models'][number]['details']
  capability_tags: ModelCapabilityTag[]
  enabled_for_chat: boolean
  is_default_chat: boolean
  is_default_embedding: boolean
  is_rerank: boolean
}

function formatBytes (bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(unit === 0 ? 0 : 1) : value.toFixed(2)} ${units[unit]}`
}

function formatDigest (digest: string | null): string {
  if (!digest) return '—'
  return digest.replace(/^sha256:/, '').slice(0, 12)
}

function formatModifiedAt (iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatModelSpec (details: ModelRow['details']): string {
  if (!details) return '—'
  const parts = [
    details.parameter_size,
    details.quantization_level,
    details.family
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

function capabilityTagClass (id: ModelCapabilityTag['id']): string {
  switch (id) {
    case 'text': return 'label-info'
    case 'embed': return 'label-purple'
    case 'vision': return 'label-orange'
    case 'audio': return 'label-pink'
    case 'moe': return 'label-warning'
    case 'rerank': return 'label-default'
    case 'cloud': return 'label-success'
    default: return 'label-default'
  }
}

function isEmbedOnlyModel (m: Pick<ModelRow, 'capability_tags'>): boolean {
  const ids = new Set(m.capability_tags.map((t) => t.id))
  return ids.has('embed') && !ids.has('text')
}

function mapModelsResponse (m: OllamaModelsResponse): ModelRow[] {
  return m.models.map((x) => {
    const row: ModelRow = {
      name: x.name,
      model_id: x.model_id,
      size_bytes: x.size_bytes,
      modified_at: x.modified_at,
      digest: x.digest,
      details: x.details,
      capability_tags: x.capability_tags,
      enabled_for_chat: x.enabled_for_chat,
      is_default_chat: x.is_default_chat,
      is_default_embedding: x.is_default_embedding,
      is_rerank: x.is_rerank
    }
    if (!isEmbedOnlyModel(row)) return row
    return {
      ...row,
      enabled_for_chat: false,
      is_default_chat: false
    }
  })
}

export function ModelsPage () {
  const [models, setModels] = useState<ModelRow[]>([])
  const [rerankEnabled, setRerankEnabled] = useState(false)
  const [health, setHealth] = useState('unknown')
  const [latency, setLatency] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inferenceNotice, setInferenceNotice] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ModelRow | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const initialChatRolesRef = useRef<Map<string, { enabled: boolean; defaultChat: boolean }>>(new Map())
  const initialEmbeddingRef = useRef<string | null>(null)
  const [reindexDialogOpen, setReindexDialogOpen] = useState(false)
  const [pendingEmbedModel, setPendingEmbedModel] = useState<string | null>(null)
  const [reindexPending, setReindexPending] = useState(false)
  const [reindexJob, setReindexJob] = useState<ReindexJobStatus | null>(null)
  const [reindexNotice, setReindexNotice] = useState<string | null>(null)

  const reloadFromOllama = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      const [m, h] = await Promise.all([fetchOllamaModels(), fetchOllamaHealth()])
      const rows = mapModelsResponse(m)
      setModels(rows)
      initialChatRolesRef.current = new Map(rows.map((row) => [row.name, {
        enabled: row.enabled_for_chat,
        defaultChat: row.is_default_chat
      }]))
      initialEmbeddingRef.current = rows.find((r) => r.is_default_embedding)?.name ?? null
      setRerankEnabled(m.defaults.rerank_enabled)
      setHealth(h.status)
      setLatency(h.latency_ms)
    } catch (e) {
      setError(e instanceof Error ? e.message : '一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadFromOllama()
  }, [reloadFromOllama])

  const reindexActive = reindexJob != null
    && (reindexJob.status === 'pending' || reindexJob.status === 'running')

  useEffect(() => {
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | undefined

    async function pollReindex () {
      try {
        const { job } = await fetchReindexStatus()
        if (cancelled) return
        setReindexJob(job)
        if (job?.status === 'completed') {
          setReindexNotice('新モデルへの切替が完了しました。')
          void reloadFromOllama()
        } else if (job?.status === 'failed') {
          setReindexNotice(job.error_message ?? '再埋め込みに失敗しました。検索は旧モデルで継続中です。')
        }
      } catch {
        // 進捗取得失敗は無視（次回ポーリングで再試行）
      }
    }

    void pollReindex()
    if (reindexActive) {
      intervalId = setInterval(() => { void pollReindex() }, 2500)
    }

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [reindexActive, reloadFromOllama])

  function updateModel (name: string, patch: Partial<ModelRow>) {
    setSaved(false)
    setModels((rows) => rows.map((r) => {
      if (r.name !== name) {
        if (patch.is_default_chat) return { ...r, is_default_chat: false }
        if (patch.is_default_embedding) return { ...r, is_default_embedding: false }
        if (patch.is_rerank) return { ...r, is_rerank: false }
        return r
      }
      return { ...r, ...patch }
    }))
  }

  async function tryChatRoleChange (name: string, patch: Partial<ModelRow>) {
    const affectsChat = patch.enabled_for_chat !== undefined || patch.is_default_chat !== undefined
    if (!affectsChat) {
      setInferenceNotice(null)
      updateModel(name, patch)
      return
    }
    try {
      const status = await fetchOllamaInferenceStatus()
      if (status.active) {
        setInferenceNotice(INFERENCE_CHAT_ROLE_BLOCK_MESSAGE)
        return
      }
      setInferenceNotice(null)
      updateModel(name, patch)
    } catch (e) {
      setError(e instanceof Error ? e.message : '推論状態の確認に失敗しました')
    }
  }

  function chatRolesChangedFromInitial (): boolean {
    for (const m of models) {
      const init = initialChatRolesRef.current.get(m.name)
      if (!init) {
        if (m.enabled_for_chat || m.is_default_chat) return true
        continue
      }
      if (m.enabled_for_chat !== init.enabled || m.is_default_chat !== init.defaultChat) return true
    }
    return false
  }

  function currentDefaultEmbedding (): string | null {
    return models.find((m) => m.is_default_embedding)?.name ?? null
  }

  function embeddingChangedFromInitial (): boolean {
    const current = currentDefaultEmbedding()
    const initial = initialEmbeddingRef.current
    return current != null && initial != null && current !== initial
  }

  function buildAssignments (keepInitialEmbedding: boolean) {
    const initialEmbed = initialEmbeddingRef.current
    return models.map((m) => {
      const embedOnly = isEmbedOnlyModel(m)
      const enabled_for_chat = embedOnly ? false : m.enabled_for_chat
      const is_default_chat = embedOnly ? false : m.is_default_chat
      const is_default_embedding = keepInitialEmbedding
        ? m.name === initialEmbed
        : m.is_default_embedding
      return {
        model_name: m.name,
        roles: [
          ...(enabled_for_chat ? ['chat'] : []),
          ...(is_default_embedding ? ['embedding'] : []),
          ...(m.is_rerank ? ['rerank'] : [])
        ],
        enabled_for_chat,
        is_default_chat,
        is_default_embedding,
        is_rerank: m.is_rerank
      }
    })
  }

  async function persistModelRoles (keepInitialEmbedding: boolean) {
    await saveModelRoles({
      rerank_enabled: rerankEnabled,
      assignments: buildAssignments(keepInitialEmbedding)
    })
  }

  function revertEmbeddingSelection () {
    const initialEmbed = initialEmbeddingRef.current
    if (!initialEmbed) return
    setModels((rows) => rows.map((r) => ({
      ...r,
      is_default_embedding: r.name === initialEmbed
    })))
  }

  async function onSave () {
    setError(null)
    setSaved(false)
    setReindexNotice(null)
    try {
      const status = await fetchOllamaInferenceStatus()
      if (status.active && chatRolesChangedFromInitial()) {
        setInferenceNotice(INFERENCE_CHAT_ROLE_BLOCK_MESSAGE)
        return
      }
      setInferenceNotice(null)

      if (embeddingChangedFromInitial()) {
        const newModel = currentDefaultEmbedding()
        if (newModel) {
          setPendingEmbedModel(newModel)
          setReindexDialogOpen(true)
        }
        return
      }

      await persistModelRoles(false)
      setSaved(true)
      await reloadFromOllama()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失敗')
    }
  }

  async function onConfirmReindex () {
    if (!pendingEmbedModel) return
    setReindexPending(true)
    setError(null)
    try {
      await persistModelRoles(true)
      await startReindex(pendingEmbedModel)
      setReindexDialogOpen(false)
      setPendingEmbedModel(null)
      setSaved(true)
      const { job } = await fetchReindexStatus()
      setReindexJob(job)
      setReindexNotice('再埋め込みを開始しました。完了まで旧モデルで検索を継続します。')
      await reloadFromOllama()
    } catch (e) {
      setError(e instanceof Error ? e.message : '再埋め込みの開始に失敗しました')
      revertEmbeddingSelection()
      setReindexDialogOpen(false)
      setPendingEmbedModel(null)
    } finally {
      setReindexPending(false)
    }
  }

  function onCancelReindex () {
    if (reindexPending) return
    setError(null)
    setReindexNotice(null)
    setSaved(false)
    revertEmbeddingSelection()
    setReindexDialogOpen(false)
    setPendingEmbedModel(null)
    void (async () => {
      try {
        await persistModelRoles(true)
        await reloadFromOllama()
      } catch (e) {
        setError(e instanceof Error ? e.message : '保存失敗')
      }
    })()
  }

  async function onConfirmDeleteModel () {
    if (!deleteTarget) return
    setDeletePending(true)
    setError(null)
    try {
      await deleteOllamaModelFromHost(deleteTarget.name)
      setDeleteTarget(null)
      setSaved(false)
      await reloadFromOllama()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'モデルの削除に失敗しました')
    } finally {
      setDeletePending(false)
    }
  }

  const enabledChatCount = models.filter((m) => m.enabled_for_chat && !isEmbedOnlyModel(m)).length

  return (
    <section className="view active" id="view-models">
      <div className="stats">
        <div className="stat-card">
          <div className={`num${health === 'ok' ? '' : ' num-danger'}`}>
            {health === 'ok' ? 'OK' : health}
          </div>
          <div className="lbl">Ollama{latency != null ? ` · ${latency}ms` : ''}</div>
        </div>
        <div className="stat-card">
          <div className="num">{models.length}</div>
          <div className="lbl">モデル数</div>
        </div>
        <div className="stat-card">
          <div className="num">{enabledChatCount}</div>
          <div className="lbl">チャット有効</div>
        </div>
        <div className="stat-card">
          <div className="num">{rerankEnabled ? 'ON' : 'OFF'}</div>
          <div className="lbl">ReRank</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-title-row">
            <h2>モデル管理（API 連携）</h2>
            <button
              type="button"
              className="btn btn-sm"
              disabled={loading}
              onClick={() => void reloadFromOllama()}
            >
              {loading ? '取得中…' : 'Ollama から一覧更新'}
            </button>
          </div>
        </div>
        <div className="panel-body">
          <div className="policy-banner">
            ホスト Ollama のモデル一覧（<code>GET /api/ollama/models</code>）。pull はホスト CLI、delete は管理者が一覧から実行可能。ロール割当は WebUI で設定します。
          </div>
          {inferenceNotice && (
            <div className="policy-banner models-runtime-notice" role="alert">
              {inferenceNotice}
            </div>
          )}
          {reindexActive && reindexJob && (
            <div className="policy-banner models-reindex-progress" role="status">
              <p>
                再埋め込み中: {reindexJob.processed_chunks} / {reindexJob.total_chunks} チャンク
                （{reindexJob.percent}%）
                {reindexJob.failed_chunks > 0 && ` · 失敗 ${reindexJob.failed_chunks}`}
                {reindexJob.model_name && ` · ${reindexJob.model_name}`}
              </p>
              <div className="models-reindex-progress-bar" aria-hidden="true">
                <div
                  className="models-reindex-progress-fill"
                  style={{ width: `${reindexJob.percent}%` }}
                />
              </div>
            </div>
          )}
          {reindexNotice && !reindexActive && (
            <div className="policy-banner models-reindex-notice" role="status">
              {reindexNotice}
            </div>
          )}

          <table className="data-table models-table">
            <thead>
              <tr>
                <th scope="col">モデル</th>
                <th scope="col">ID</th>
                <th scope="col">サイズ</th>
                <th scope="col">最終更新</th>
                <th scope="col">仕様</th>
                <th scope="col">チャット有効</th>
                <th scope="col">既定チャット</th>
                <th scope="col">既定埋め込み</th>
                <th scope="col">ReRank</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const embedOnly = isEmbedOnlyModel(m)
                return (
                <tr
                  key={m.name}
                  className={[
                    embedOnly ? 'model-row-embed-only' : '',
                    !embedOnly && m.enabled_for_chat ? 'model-row-chat-enabled' : '',
                    !embedOnly && m.is_default_chat ? 'model-row-default-chat' : '',
                    !embedOnly && m.is_default_embedding ? 'model-row-default-embed' : ''
                  ].filter(Boolean).join(' ')}
                >
                  <td>
                    <div className="model-name-cell">
                      <code className="model-name-primary">{m.name}</code>
                      {m.capability_tags.length > 0 && (
                        <div className="label-row model-capability-tags">
                          {m.capability_tags.map((tag) => (
                            <span
                              key={`${m.name}-${tag.id}`}
                              className={`label ${capabilityTagClass(tag.id)}`}
                            >
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {m.model_id !== m.name && (
                        <span className="model-name-sub">{m.model_id}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <code className="model-digest" title={m.digest ?? undefined}>
                      {formatDigest(m.digest)}
                    </code>
                  </td>
                  <td>{formatBytes(m.size_bytes)}</td>
                  <td>{formatModifiedAt(m.modified_at)}</td>
                  <td className="model-spec-cell">{formatModelSpec(m.details)}</td>
                  <td className="model-role-cell">
                    {embedOnly ? (
                      <span className="model-role-na" title="Embed 専用モデル">—</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={m.enabled_for_chat}
                        aria-label={`${m.name} をチャット有効`}
                        onChange={(e) => void tryChatRoleChange(m.name, {
                          enabled_for_chat: e.target.checked,
                          ...(e.target.checked ? {} : { is_default_chat: false })
                        })}
                      />
                    )}
                  </td>
                  <td className="model-role-cell">
                    {embedOnly ? (
                      <span className="model-role-na" title="Embed 専用モデル">—</span>
                    ) : (
                      <input
                        type="radio"
                        name="default_chat"
                        checked={m.is_default_chat}
                        aria-label={`${m.name} を既定チャット`}
                        onChange={() => void tryChatRoleChange(m.name, { is_default_chat: true, enabled_for_chat: true })}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      type="radio"
                      name="default_embed"
                      checked={m.is_default_embedding}
                      disabled={reindexActive}
                      aria-label={`${m.name} を既定埋め込み`}
                      onChange={() => updateModel(m.name, { is_default_embedding: true })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={m.is_rerank}
                      aria-label={`${m.name} を ReRank`}
                      onChange={(e) => updateModel(m.name, { is_rerank: e.target.checked })}
                    />
                  </td>
                  <td className="model-actions-cell">
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      aria-label={`${m.name} をホストから削除`}
                      onClick={() => setDeleteTarget(m)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>

          <div className="form-section">
            <h3>デフォルト・ReRank</h3>
            <label className="rerank-toggle">
              <input
                type="checkbox"
                checked={rerankEnabled}
                onChange={(e) => { setRerankEnabled(e.target.checked); setSaved(false) }}
              />
              ReRank を有効化（既定: off）
            </label>
            <p className="rag-register-note models-page-note">
              一覧は保存時・更新ボタン押下時に Ollama の <code>/api/tags</code> から取得します（<code>ollama list</code> 相当: ID・サイズ・最終更新）。pull した新モデルは「一覧更新」を押してください。
            </p>
            {error && <p className="error">{error}</p>}
            {saved && <p className="meta">設定を保存しました（AI 検索のモデル一覧に反映されます）</p>}
            <div className="form-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void onSave()}>
                設定を保存
              </button>
            </div>
          </div>
        </div>
      </div>

      <ModelDeleteDialog
        open={deleteTarget != null}
        targetLabel={deleteTarget?.name ?? ''}
        pending={deletePending}
        onCancel={() => {
          if (!deletePending) setDeleteTarget(null)
        }}
        onConfirm={() => void onConfirmDeleteModel()}
      />

      <ReindexConfirmDialog
        open={reindexDialogOpen}
        targetLabel={pendingEmbedModel ?? ''}
        pending={reindexPending}
        onCancel={onCancelReindex}
        onConfirm={() => void onConfirmReindex()}
      />
    </section>
  )
}
