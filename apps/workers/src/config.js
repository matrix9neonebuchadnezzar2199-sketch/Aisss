function required (name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

export function loadConfig () {
  return {
    databaseUrl: required('DATABASE_URL'),
    pollIntervalMs: Number(process.env.WORKER_POLL_MS ?? '5000'),
    objectStorage: {
      endpoint: required('OBJECT_STORAGE_ENDPOINT'),
      bucket: process.env.OBJECT_STORAGE_BUCKET ?? 'aisss',
      accessKey: required('OBJECT_STORAGE_ACCESS_KEY'),
      secretKey: required('OBJECT_STORAGE_SECRET_KEY')
    }
  }
}
