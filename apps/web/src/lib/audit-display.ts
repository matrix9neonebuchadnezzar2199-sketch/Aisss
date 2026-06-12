import { CASE_MASTER_FIELDS } from './master-catalog'

export type AuditDetails = Record<string, unknown>

export type AuditRowLike = {
  action: string
  resource_type?: string
  resource_id?: string
  details_json?: AuditDetails | null
}

const MASTER_LABEL_BY_KEY = Object.fromEntries(
  CASE_MASTER_FIELDS.map((field) => [field.key, field.label])
)

export function formatAuditAction (action: string): string {
  switch (action) {
    case 'master.create': return 'マスタ追加'
    case 'master.update': return 'マスタ編集'
    case 'master.deactivate': return 'マスタ削除（無効化）'
    default: return action
  }
}

function masterLabelFromDetails (details: AuditDetails | null | undefined, resourceType?: string): string {
  const masterKey = typeof details?.master === 'string' ? details.master : resourceType
  if (!masterKey) return '—'
  return MASTER_LABEL_BY_KEY[masterKey] ?? masterKey
}

function masterNameFromDetails (details: AuditDetails | null | undefined): string | null {
  if (!details) return null
  if (typeof details.name === 'string' && details.name.trim()) return details.name.trim()
  if (typeof details.name_after === 'string' && details.name_after.trim()) return details.name_after.trim()
  if (typeof details.name_before === 'string' && details.name_before.trim()) return details.name_before.trim()
  return null
}

export function formatAuditResource (row: AuditRowLike): string {
  if (!row.action.startsWith('master.')) {
    const type = row.resource_type ?? '—'
    const id = row.resource_id ? row.resource_id.slice(0, 8) : ''
    return id ? `${type} ${id}` : type
  }
  const label = masterLabelFromDetails(row.details_json, row.resource_type)
  const name = masterNameFromDetails(row.details_json)
  return name ? `${label}: ${name}` : label
}

export function isMasterAuditAction (action: string): boolean {
  return action.startsWith('master.')
}

export function formatMasterAuditNote (details: AuditDetails | null | undefined): string | null {
  if (!details) return null
  const before = typeof details.name_before === 'string' ? details.name_before : null
  const after = typeof details.name_after === 'string' ? details.name_after : null
  if (before && after && before !== after) {
    return `「${before}」→「${after}」`
  }
  if (typeof details.name === 'string' && details.name.trim()) {
    return `候補: ${details.name.trim()}`
  }
  return null
}
