import type pg from 'pg'

/** キーワード名を find-or-create して case_keywords を置き換え */
export async function syncCaseKeywords (
  executor: pg.Pool | pg.PoolClient,
  caseId: string,
  keywordNames: string[] | undefined
): Promise<void> {
  if (keywordNames === undefined) return
  await executor.query(`DELETE FROM case_keywords WHERE case_id = $1`, [caseId])
  for (const raw of keywordNames) {
    const name = raw.trim()
    if (!name) continue
    const existing = await executor.query<{ id: string }>(
      `SELECT id FROM keywords WHERE name = $1`,
      [name]
    )
    let keywordId = existing.rows[0]?.id
    if (!keywordId) {
      const inserted = await executor.query<{ id: string }>(
        `INSERT INTO keywords (name) VALUES ($1) RETURNING id`,
        [name]
      )
      keywordId = inserted.rows[0]?.id
    }
    if (keywordId) {
      await executor.query(
        `INSERT INTO case_keywords (case_id, keyword_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [caseId, keywordId]
      )
    }
  }
}

export async function loadCaseKeywords (
  pool: pg.Pool,
  caseId: string
): Promise<Array<{ id: string; name: string }>> {
  const { rows } = await pool.query<{ id: string; name: string }>(
    `SELECT k.id, k.name
     FROM keywords k
     JOIN case_keywords ck ON ck.keyword_id = k.id
     WHERE ck.case_id = $1
     ORDER BY k.name`,
    [caseId]
  )
  return rows
}
