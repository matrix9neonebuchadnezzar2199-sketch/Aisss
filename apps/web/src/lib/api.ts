const USER_KEY = 'aisss-user-id'
const DEFAULT_USER = '00000000-0000-4000-8000-000000000001'

export function getUserId (): string {
  return localStorage.getItem(USER_KEY) ?? DEFAULT_USER
}

export function setUserId (id: string): void {
  localStorage.setItem(USER_KEY, id)
}

export async function apiFetch<T> (path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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
  content_type?: string
  file_size?: number
  uploaded_at?: string
}

export async function uploadAttachment (caseId: string, file: File): Promise<AttachmentItem> {
  const form = new FormData()
  form.append('file', file)
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

export async function retryExtraction (attachmentId: string): Promise<void> {
  await apiFetch(`/api/attachments/${attachmentId}/retry-extraction`, { method: 'POST' })
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

export type CaseDetail = CaseListItem & {
  summary?: string
  body_summary?: string
  body_article?: string
  body_assessment?: string
  body_reference?: string
  material_type_id?: string
  registering_department_id?: string
  rank_id?: string
  viewing_ranges?: Array<{ id: string; name: string }>
  attachments?: AttachmentItem[]
}

export type OllamaModelsResponse = {
  models: Array<{
    name: string
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

export async function fetchOllamaHealth (): Promise<{ status: string; latency_ms: number | null }> {
  const res = await fetch('/api/ollama/health')
  return res.json() as Promise<{ status: string; latency_ms: number | null }>
}

export async function sendAiChat (message: string, model?: string): Promise<AiChatResponse> {
  return apiFetch('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, model })
  })
}

export type RagFileItem = {
  id: string
  source_kind: 'case_attachment' | 'standalone'
  title: string
  file_name: string
  case_id: string | null
  case_display_id: string | null
  viewing_range_labels: string[]
  editable_viewing_range: boolean
  pipeline_status: string
  rag_enabled: boolean
  extraction_status: string
}

export async function fetchRagStatus (): Promise<{
  chunk_count: number
  embedding_pending: number
  pipeline_failed: number
  vectors_synced: number
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
