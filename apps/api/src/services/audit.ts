import type pg from 'pg'

export async function writeAuditLog (
  pool: pg.Pool,
  input: {
    userId: string | null
    action: string
    resourceType?: string
    resourceId?: string
    caseDisplayId?: string
    queryId?: string
    details?: Record<string, unknown>
  }
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs (
      user_id, action, resource_type, resource_id,
      case_display_id, query_id, details_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      input.userId,
      input.action,
      input.resourceType ?? null,
      input.resourceId ?? null,
      input.caseDisplayId ?? null,
      input.queryId ?? null,
      JSON.stringify(input.details ?? {})
    ]
  )
}
