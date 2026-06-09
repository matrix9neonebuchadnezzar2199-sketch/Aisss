import path from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

export type Settings = {
  host: string
  port: number
  databaseUrl: string
  ollamaBaseUrl: string
  migrateOnStart: boolean
  migrationsDir: string
}

function required (name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function loadSettings (): Settings {
  return {
    host: process.env.API_HOST ?? '0.0.0.0',
    port: Number(process.env.API_PORT ?? process.env.PORT ?? '8000'),
    databaseUrl: required('DATABASE_URL'),
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://host.docker.internal:11434',
    migrateOnStart: (process.env.API_MIGRATE_ON_START ?? 'true').toLowerCase() !== 'false',
    migrationsDir: process.env.MIGRATIONS_DIR ?? path.resolve(moduleDir, '../../../infra/migrations')
  }
}
