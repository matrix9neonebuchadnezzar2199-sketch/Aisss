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
