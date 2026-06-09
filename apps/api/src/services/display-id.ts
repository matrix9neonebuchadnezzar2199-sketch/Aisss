import type pg from 'pg'

export async function nextDisplayId (pool: pg.Pool): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `CASE-${year}-`
  const { rows } = await pool.query<{ next_num: string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(display_id FROM $1) AS INTEGER)), 0) + 1 AS next_num
     FROM cases
     WHERE display_id LIKE $2`,
    [prefix.length + 1, `${prefix}%`]
  )
  const num = Number(rows[0]?.next_num ?? 1)
  return `${prefix}${String(num).padStart(5, '0')}`
}
