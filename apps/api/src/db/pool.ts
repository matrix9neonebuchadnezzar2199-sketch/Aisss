import pg from 'pg'

const { Pool } = pg

let pool: pg.Pool | undefined

export function getPool (databaseUrl: string): pg.Pool {
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl })
  }
  return pool
}

export async function closePool (): Promise<void> {
  if (pool) {
    await pool.end()
    pool = undefined
  }
}

export async function checkDatabase (databaseUrl: string): Promise<boolean> {
  const client = await getPool(databaseUrl).connect()
  try {
    await client.query('SELECT 1')
    return true
  } finally {
    client.release()
  }
}
