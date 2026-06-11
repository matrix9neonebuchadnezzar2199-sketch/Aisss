import type pg from 'pg'

export type AuditStats = {
  total_today: number
  case_ops: number
  ai_ops: number
  permission_ops: number
}

export async function getAuditStats (pool: pg.Pool): Promise<AuditStats> {
  const { rows } = await pool.query<{
    total_today: string
    case_ops: string
    ai_ops: string
    permission_ops: string
  }>(
    `SELECT
       COUNT(*)::text AS total_today,
       COUNT(*) FILTER (WHERE action LIKE 'case.%')::text AS case_ops,
       COUNT(*) FILTER (WHERE action LIKE 'ai.%')::text AS ai_ops,
       COUNT(*) FILTER (WHERE
         action LIKE 'master.%' OR
         action LIKE 'group.%' OR
         action LIKE 'user.%' OR
         action LIKE 'viewing_range.%' OR
         action LIKE 'permission.%'
       )::text AS permission_ops
     FROM audit_logs
     WHERE created_at >= CURRENT_DATE`
  )
  const row = rows[0]
  return {
    total_today: Number(row?.total_today ?? 0),
    case_ops: Number(row?.case_ops ?? 0),
    ai_ops: Number(row?.ai_ops ?? 0),
    permission_ops: Number(row?.permission_ops ?? 0)
  }
}
