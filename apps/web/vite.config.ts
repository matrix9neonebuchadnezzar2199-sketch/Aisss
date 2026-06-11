import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const webRoot = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(webRoot, '../..')

function readRootVersion (): string {
  if (process.env.VITE_APP_VERSION) return process.env.VITE_APP_VERSION
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { version?: string }
  return pkg.version ?? '0.0.0'
}

function readGitSha (): string {
  if (process.env.VITE_GIT_SHA || process.env.GIT_SHA) {
    return process.env.VITE_GIT_SHA ?? process.env.GIT_SHA ?? 'dev'
  }
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: repoRoot }).trim()
  } catch {
    return 'dev'
  }
}

const appVersion = readRootVersion()
const gitSha = readGitSha()

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_GIT_SHA__: JSON.stringify(gitSha)
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 3000,
    host: true
  }
})
