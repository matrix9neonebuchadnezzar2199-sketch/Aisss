#!/usr/bin/env node
/**
 * Resolve SemVer + git SHA for Vite / Docker build args.
 * Usage: node apps/web/scripts/resolve-build-meta.mjs [--export-shell|--export-powershell]
 *
 * Git SHA is read from the repo by default (not stale shell env).
 * Set GIT_SHA only inside Docker build where .git is unavailable.
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../../..')

function readRootVersion () {
  const rootPkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
  return process.env.APP_VERSION ?? process.env.VITE_APP_VERSION ?? rootPkg.version ?? '0.0.0'
}

function readGitSha () {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: repoRoot }).trim()
  } catch {
    return process.env.GIT_SHA ?? process.env.VITE_GIT_SHA ?? 'dev'
  }
}

const meta = { version: readRootVersion(), gitSha: readGitSha() }
const mode = process.argv[2]

if (mode === '--export-shell') {
  process.stdout.write(`export APP_VERSION=${meta.version}\nexport GIT_SHA=${meta.gitSha}\n`)
} else if (mode === '--export-powershell') {
  process.stdout.write(`$env:APP_VERSION='${meta.version}'\n$env:GIT_SHA='${meta.gitSha}'\n`)
} else {
  process.stdout.write(JSON.stringify(meta))
}
