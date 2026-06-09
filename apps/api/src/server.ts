import { getPool, closePool } from './db/pool.js'
import { runMigrations } from './db/migrate.js'
import { buildApp } from './app.js'
import { loadSettings } from './settings.js'
import { createStorageClient, ensureBucket } from './services/storage.js'

async function main (): Promise<void> {
  const settings = loadSettings()
  const pool = getPool(settings.databaseUrl)

  if (settings.migrateOnStart) {
    const applied = await runMigrations(pool, settings.migrationsDir)
    if (applied.length > 0) {
      console.log(`Applied migrations: ${applied.join(', ')}`)
    }
  }

  const storage = createStorageClient(settings.objectStorage)
  await ensureBucket(storage, settings.objectStorage.bucket)

  const app = await buildApp({ settings, pool, storage })

  const shutdown = async () => {
    await app.close()
    await closePool()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await app.listen({ host: settings.host, port: settings.port })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
