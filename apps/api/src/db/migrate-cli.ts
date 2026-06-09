import { closePool, getPool } from './pool.js'
import { runMigrations } from './migrate.js'
import { loadSettings } from '../settings.js'

async function main (): Promise<void> {
  const settings = loadSettings()
  const pool = getPool(settings.databaseUrl)
  const applied = await runMigrations(pool, settings.migrationsDir)
  if (applied.length === 0) {
    console.log('No pending migrations.')
  } else {
    console.log(`Applied: ${applied.join(', ')}`)
  }
  await closePool()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
