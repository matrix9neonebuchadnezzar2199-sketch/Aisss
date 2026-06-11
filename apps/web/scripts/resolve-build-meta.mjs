#!/usr/bin/env node
/**
 * Resolve SemVer + git SHA for Vite / Docker build args.
 * Usage: node scripts/resolve-build-meta.mjs [--export-shell|--export-powershell]
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const rootPkg = JSON.parse(readFileSync(join(here, '../../../package.json'), 'utf8'))

function gitSha () {
  if (process.env.GIT_SHA || process.env.VITE_GIT_SHA) {
    return process.env.GIT_SHA ?? process.env.VITE_GIT_SHA
  }
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

function appVersion () {
  return process.env.APP_VERSION ?? process.env.VITE_APP_VERSION ?? rootPkg.version ?? '0.0.0'
}

const meta = { version: appVersion(), gitSha: gitSha() }
const mode = process.argv[2]

if (mode === '--export-shell') {
  process.stdout.write(`export APP_VERSION=${meta.version}\nexport GIT_SHA=${meta.gitSha}\n`)
} else if (mode === '--export-powershell') {
  process.stdout.write(`$env:APP_VERSION='${meta.version}'\n$env:GIT_SHA='${meta.gitSha}'\n`)
} else {
  process.stdout.write(JSON.stringify(meta))
}
