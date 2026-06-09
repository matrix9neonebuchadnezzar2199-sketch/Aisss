import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type pg from 'pg'

async function listMigrationFiles (migrationsDir: string): Promise<string[]> {
  const entries = await readdir(migrationsDir)
  return entries.filter((name) => name.endsWith('.sql')).sort()
}

export async function runMigrations (
  pool: pg.Pool,
  migrationsDir: string
): Promise<string[]> {
  const client = await pool.connect()
  const applied: string[] = []

  try {
    await client.query('BEGIN')
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const files = await listMigrationFiles(migrationsDir)

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [file]
      )
      if (rows.length > 0) {
        continue
      }

      const sql = await readFile(path.join(migrationsDir, file), 'utf8')
      await client.query(sql)
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [file]
      )
      applied.push(file)
    }

    await client.query('COMMIT')
    return applied
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
