const USER_KEY = 'aisss-user-id'
const DEFAULT_USER = '00000000-0000-4000-8000-000000000001'

export function getUserId (): string {
  return localStorage.getItem(USER_KEY) ?? DEFAULT_USER
}

export function setUserId (id: string): void {
  localStorage.setItem(USER_KEY, id)
}

export async function apiFetch<T> (path: string, init?: RequestInit): Promise<T> {
  const hasJsonBody = init?.body != null && init.body !== ''
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      'X-AISSS-User-Id': getUserId(),
      ...(init?.headers ?? {})
    }
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

export type MasterItem = { id: string; name: string; code?: string | null }
export type CaseListItem = {
  id: string
  display_id: string
  title: string
  material_number?: string
  event_start_date?: string
  material_type_name?: string
  department_name?: string
  rank_name?: string
  updated_at: string
}

export type AttachmentItem = {
  id: string
  file_name: string
  extraction_status: string
  extraction_error?: string | null
  rag_enabled?: boolean
  auto_enable_rag_on_extraction?: boolean
  content_type?: string
  file_size?: number
  uploaded_at?: string
}

export async function uploadAttachment (
  caseId: string,
  file: File,
  autoEnableRagOnExtraction = false
): Promise<AttachmentItem> {
  const form = new FormData()
  form.append('file', file)
  form.append('auto_enable_rag_on_extraction', String(autoEnableRagOnExtraction))
  const response = await fetch(`/api/cases/${caseId}/attachments`, {
    method: 'POST',
    headers: { 'X-AISSS-User-Id': getUserId() },
    body: form
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `HTTP ${response.status}`)
  }
  return response.json() as Promise<AttachmentItem>
}

export async function setAttachmentAutoEnableRag (
  attachmentId: string,
  enabled: boolean
): Promise<void> {
  await apiFetch(`/api/attachments/${attachmentId}/auto-enable-rag`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled })
  })
}

export async function retryExtraction (attachmentId: string): Promise<void> {
  // Content-Type: application/json を送る以上、空 body は Fastify に拒否されるため {} を明示する
  await apiFetch(`/api/attachments/${attachmentId}/retry-extraction`, {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export type ExtractedText = {
  attachment_id: string
  text?: string | null
  status?: string
  source_type?: string
  extraction_engine?: string
}

export async function fetchExtractedText (attachmentId: string): Promise<ExtractedText> {
  return apiFetch<ExtractedText>(`/api/attachments/${attachmentId}/extracted-text`)
}

export function attachmentDownloadUrl (attachmentId: string): string {
  return `/api/attachments/${attachmentId}/download`
}

/** 認証ヘッダ付きで添付を blob ダウンロード（`<a href>` では X-AISSS-User-Id が送れない） */
export async function downloadAttachment (attachmentId: string, fileName: string): Promise<void> {
  const res = await fetch(attachmentDownloadUrl(attachmentId), {
    headers: { 'X-AISSS-User-Id': getUserId() }
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `HTTP ${res.status}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export type AuditLogEntry = {
  id: string
  action: string
  query_id?: string | null
  case_display_id?: string | null
  details_json?: Record<string, unknown> | null
  created_at: string
  user_name?: string | null
}

export async function fetchAuditLogByQueryId (queryId: string): Promise<AuditLogEntry | null> {
  const data = await apiFetch<{ items: AuditLogEntry[] }>(
    `/api/audit-logs?${new URLSearchParams({ query_id: queryId, limit: '1' })}`
  )
  return data.items[0] ?? null
}

export type CaseDetail = CaseListItem & {
  summary?: string
  body_summary?: string
  body_article?: string
  body_assessment?: string
  body_reference?: string
  event_end_date?: string
  material_type_id?: string
  registering_department_id?: string
  rank_id?: string
  classification_number?: string
  category_id?: string
  region_id?: string
  source_id?: string
  registrant_id?: string
  information_request_id?: string
  handling_type_id?: string
  reliability_id?: string
  accuracy_id?: string
  retention_policy_id?: string
  acquisition_location_id?: string
  action_taken?: string
  condition_notes?: string
  viewing_range_note?: string
  note_1?: string
  note_2?: string
  note_3?: string
  note_4?: string
  note_5?: string
  note_6?: string
  viewing_ranges?: Array<{ id: string; name: string }>
  conditions?: Array<{ id: string; name: string }>
  keywords?: Array<{ id: string; name: string }>
  collectors?: Array<{ id: string; name: string }>
  attachments?: AttachmentItem[]
}

export type OllamaModelDetails = {
  format?: string
  family?: string
  families?: string[]
  parameter_size?: string
  quantization_level?: string
}

export type ModelCapabilityTagId =
  | 'text'
  | 'embed'
  | 'audio'
  | 'vision'
  | 'moe'
  | 'rerank'
  | 'cloud'

export type ModelCapabilityTag = {
  id: ModelCapabilityTagId
  label: string
}

export type OllamaModelsResponse = {
  models: Array<{
    name: string
    model_id: string
    size_bytes: number
    modified_at: string
    digest: string | null
    details: OllamaModelDetails | null
    capability_tags: ModelCapabilityTag[]
    enabled_for_chat: boolean
    is_default_chat: boolean
    is_default_embedding: boolean
    is_rerank: boolean
    roles: string[]
  }>
  defaults: {
    chat_model: string | null
    embedding_model: string | null
    rerank_model: string | null
    rerank_enabled: boolean
    enabled_chat_models: string[]
  }
}

export type AiCitation = {
  display_id: string | null
  title: string
  source_type: string
  policies: { quote_policy: string; export_policy: string }
}

export type AiChatResponse = {
  answer: string
  model: string
  query_id: string
  citations: AiCitation[]
  effective_policies: { quote_policy: string; export_policy: string }
}

export async function fetchOllamaModels (): Promise<OllamaModelsResponse> {
  return apiFetch('/api/ollama/models')
}

export async function fetchOllamaInferenceStatus (): Promise<{ active: boolean; models: string[] }> {
  return apiFetch('/api/ollama/inference-status')
}

/** 推論中にチャットロール変更を試みたときの案内文 */
export const INFERENCE_CHAT_ROLE_BLOCK_MESSAGE =
  'モデルが動作中です。強制的にチャット有効対象を変更して有効化したい場合は Ollama を強制終了して再起動してください。'

/** Models marked チャット有効 in model management (saved in DB). */
export function getEnabledChatModelNames (response: OllamaModelsResponse): string[] {
  return response.defaults.enabled_chat_models
}

export function resolveDefaultChatModel (
  enabled: string[],
  defaultName: string | null
): string {
  if (defaultName && enabled.includes(defaultName)) return defaultName
  return enabled[0] ?? ''
}

export async function fetchOllamaHealth (): Promise<{ status: string; latency_ms: number | null }> {
  try {
    const res = await fetch('/api/ollama/health')
    if (!res.ok) return { status: 'down', latency_ms: null }
    return await res.json() as { status: string; latency_ms: number | null }
  } catch {
    return { status: 'down', latency_ms: null }
  }
}

export async function sendAiChat (message: string, model?: string): Promise<AiChatResponse> {
  return apiFetch('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, model })
  })
}

export type AiChatStreamEvent =
  | { type: 'meta'; query_id: string; model: string; citations: AiChatResponse['citations']; effective_policies: AiChatResponse['effective_policies'] }
  | { type: 'token'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

/** SSE `/api/ai/chat/stream` — token 単位でコールバック */
export async function sendAiChatStream (
  message: string,
  model: string | undefined,
  onEvent: (event: AiChatStreamEvent) => void
): Promise<void> {
  const response = await fetch('/api/ai/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AISSS-User-Id': getUserId()
    },
    body: JSON.stringify({ message, model })
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `HTTP ${response.status}`)
  }
  if (!response.body) throw new Error('Stream body missing')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      try {
        onEvent(JSON.parse(line.slice(6)) as AiChatStreamEvent)
      } catch {
        // malformed SSE chunk — skip
      }
    }
  }
}

export type RagFileItem = {
  id: string
  source_kind: 'case_attachment' | 'standalone'
  title: string
  file_name: string
  case_id: string | null
  case_display_id: string | null
  viewing_range_ids: string[]
  viewing_range_labels: string[]
  editable_viewing_range: boolean
  pipeline_status: string
  rag_enabled: boolean
  auto_enable_rag_on_extraction: boolean
  extraction_status: string
  rag_visibility_state: string
  rag_visibility_label: string
  is_knowledge_candidate: boolean
  tags?: string[]
  registered_at?: string
}

export type RagStorageCategoryId = 'case_text' | 'office' | 'pdf' | 'audio' | 'image'

export type RagStorageCategory = {
  id: RagStorageCategoryId
  label: string
  bytes: number
  file_count: number
  chunk_count: number
  indexed_bytes: number
}

export type RagStorageBreakdown = {
  total_bytes: number
  total_files: number
  total_chunks: number
  categories: RagStorageCategory[]
}

export type RagTreeFile = {
  id: string
  label: string
  rag_enabled: boolean
  source_kind: 'case_attachment' | 'standalone'
  extraction_status: string
  auto_enable_rag_on_extraction?: boolean
  rag_visibility_state?: string
  rag_visibility_label?: string
}

export type RagTreeGroup = {
  id: string
  label: string
  files: RagTreeFile[]
}

export type RagTreeGenre = {
  id: string
  label: string
  groups: RagTreeGroup[]
}

export async function fetchRagTree (): Promise<{ genres: RagTreeGenre[] }> {
  return apiFetch('/api/rag/tree')
}

export async function fetchRagStatus (): Promise<{
  chunk_count: number
  embedding_pending: number
  pipeline_failed: number
  vectors_synced: number
  not_enabled_candidates: number
  auto_enable_reserved: number
  storage_breakdown: RagStorageBreakdown
}> {
  return apiFetch('/api/rag/status')
}

export async function fetchRagFiles (params?: Record<string, string>): Promise<{ items: RagFileItem[] }> {
  const qs = params ? `?${new URLSearchParams(params)}` : ''
  return apiFetch(`/api/rag/files${qs}`)
}

export async function setRagEnabled (
  fileId: string,
  enabled: boolean,
  sourceKind: RagFileItem['source_kind']
): Promise<void> {
  await apiFetch(`/api/rag/files/${fileId}/enable`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled, source_kind: sourceKind })
  })
}

export async function uploadStandaloneFile (input: {
  title: string
  viewingRangeIds: string[]
  tags: string[]
  file: File
}): Promise<{ id: string }> {
  const form = new FormData()
  form.append('title', input.title)
  form.append('viewing_range_ids', JSON.stringify(input.viewingRangeIds))
  form.append('tags', JSON.stringify(input.tags))
  form.append('file', input.file)
  const response = await fetch('/api/rag/standalone-files', {
    method: 'POST',
    headers: { 'X-AISSS-User-Id': getUserId() },
    body: form
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `HTTP ${response.status}`)
  }
  return response.json() as Promise<{ id: string }>
}

export async function updateStandaloneViewingRanges (
  fileId: string,
  viewingRangeIds: string[]
): Promise<void> {
  await apiFetch(`/api/rag/standalone-files/${fileId}/viewing-ranges`, {
    method: 'PATCH',
    body: JSON.stringify({ viewing_range_ids: viewingRangeIds })
  })
}

export async function deleteRagFile (
  item: Pick<RagFileItem, 'id' | 'source_kind'>
): Promise<void> {
  if (item.source_kind === 'standalone') {
    await apiFetch(`/api/rag/standalone-files/${item.id}`, { method: 'DELETE' })
    return
  }
  await apiFetch(`/api/attachments/${item.id}`, { method: 'DELETE' })
}

export async function bulkReindexRag (): Promise<{ jobs_enqueued: number }> {
  return apiFetch('/api/rag/bulk-reindex', { method: 'POST', body: '{}' })
}

export async function saveModelRoles (input: {
  assignments: Array<{
    model_name: string
    roles: string[]
    enabled_for_chat: boolean
    is_default_chat: boolean
    is_default_embedding: boolean
    is_rerank: boolean
  }>
  rerank_enabled: boolean
}): Promise<void> {
  await apiFetch('/api/admin/ollama/model-roles', {
    method: 'PUT',
    body: JSON.stringify(input)
  })
}

export async function deleteOllamaModelFromHost (modelName: string): Promise<void> {
  await apiFetch('/api/admin/ollama/models/delete', {
    method: 'POST',
    body: JSON.stringify({ model_name: modelName })
  })
}

export type ReindexJobStatus = {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  total_chunks: number
  processed_chunks: number
  failed_chunks: number
  percent: number
  model_name: string | null
  started_at: string | null
  finished_at: string | null
  error_message: string | null
}

export async function startReindex (modelName: string): Promise<{
  reindex_job_id: string
  collection_name: string
  dimensions: number
}> {
  return apiFetch('/api/admin/reindex', {
    method: 'POST',
    body: JSON.stringify({ model_name: modelName })
  })
}

export async function fetchReindexStatus (): Promise<{ job: ReindexJobStatus | null }> {
  return apiFetch('/api/admin/reindex/current')
}

export type JobItem = {
  id: string
  job_type: string
  status: string
  case_display_id?: string | null
  attachment_id?: string | null
  error?: string | null
  retry_count: number
  max_attempts: number
  dead_lettered_at?: string | null
  updated_at: string
}

export type JobStats = {
  running: number
  pending: number
  failed: number
  dead_letter: number
  completed_today: number
  by_type: Record<string, Record<string, number>>
}

export async function fetchJobStats (): Promise<JobStats> {
  return apiFetch('/api/jobs/stats')
}

export async function fetchJobs (params?: Record<string, string>): Promise<{ items: JobItem[]; total: number }> {
  const qs = params ? `?${new URLSearchParams(params)}` : ''
  return apiFetch(`/api/jobs${qs}`)
}

export async function retryJob (jobId: string): Promise<void> {
  await apiFetch(`/api/jobs/${jobId}/retry`, {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export async function deadLetterJob (jobId: string, reason?: string): Promise<void> {
  await apiFetch(`/api/jobs/${jobId}/dead-letter`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  })
}

export type AdminDashboard = {
  cases: number
  failed_extractions: number
  failed_jobs: number
  rag_chunks: number
  audit_events_today: number
  open_feedback: number
}

export async function fetchAdminDashboard (): Promise<AdminDashboard> {
  return apiFetch('/api/admin/dashboard')
}

export type AuditStats = {
  total_today: number
  case_ops: number
  ai_ops: number
  permission_ops: number
}

export async function fetchAuditStats (): Promise<AuditStats> {
  return apiFetch('/api/audit-logs/stats')
}

export type PilotFeedback = {
  id: string
  area: string
  severity: string
  title: string
  description: string
  status: string
  submitted_by_name?: string
  created_at: string
}

export async function fetchPilotFeedback (): Promise<{ items: PilotFeedback[] }> {
  return apiFetch('/api/pilot/feedback')
}

export async function createPilotFeedback (input: {
  area: string
  severity: string
  title: string
  description: string
}): Promise<void> {
  await apiFetch('/api/pilot/feedback', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export async function updatePilotFeedbackStatus (id: string, status: string): Promise<void> {
  await apiFetch(`/api/pilot/feedback/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  })
}

export type UserRow = {
  id: string
  external_id: string | null
  display_name: string
  department_id: string | null
  department_name?: string | null
  role: string
}

export type GroupRow = {
  id: string
  name: string
  is_active: boolean
  members: Array<{ user_id: string; display_name: string }>
}

export type ViewingRangeRow = {
  id: string
  code: string | null
  name: string
  sort_order: number
  group_ids: string[]
}

export async function fetchUsers (q?: string): Promise<{ items: UserRow[] }> {
  const qs = q ? `?${new URLSearchParams({ q })}` : ''
  return apiFetch(`/api/users${qs}`)
}

export async function fetchGroups (): Promise<{ items: GroupRow[] }> {
  return apiFetch('/api/groups')
}

export async function fetchViewingRangesWithGroups (): Promise<{ items: ViewingRangeRow[] }> {
  return apiFetch('/api/viewing-ranges')
}

export async function updateGroupMembers (groupId: string, userIds: string[]): Promise<void> {
  await apiFetch(`/api/groups/${groupId}/members`, {
    method: 'PUT',
    body: JSON.stringify({ user_ids: userIds })
  })
}

export async function updateViewingRangeGroups (viewingRangeId: string, groupIds: string[]): Promise<void> {
  await apiFetch(`/api/viewing-ranges/${viewingRangeId}/groups`, {
    method: 'PUT',
    body: JSON.stringify({ group_ids: groupIds })
  })
}

export async function createGroup (name: string): Promise<{ id: string; name: string }> {
  return apiFetch('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name })
  })
}
