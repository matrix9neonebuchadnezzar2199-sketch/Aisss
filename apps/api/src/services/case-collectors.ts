import type pg from 'pg'

export async function syncCaseCollectors (
  executor: pg.Pool | pg.PoolClient,
  caseId: string,
  personIds: string[] | undefined
): Promise<void> {
  if (personIds === undefined) return
  await executor.query(`DELETE FROM case_collectors WHERE case_id = $1`, [caseId])
  for (const personId of personIds) {
    if (!personId) continue
    await executor.query(
      `INSERT INTO case_collectors (case_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [caseId, personId]
    )
  }
}

export async function loadCaseCollectors (
  pool: pg.Pool,
  caseId: string
): Promise<Array<{ id: string; name: string }>> {
  const { rows } = await pool.query<{ id: string; name: string }>(
    `SELECT p.id, p.name
     FROM persons p
     JOIN case_collectors cc ON cc.person_id = p.id
     WHERE cc.case_id = $1
     ORDER BY p.name`,
    [caseId]
  )
  return rows
}
