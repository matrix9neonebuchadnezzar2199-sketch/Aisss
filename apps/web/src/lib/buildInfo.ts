/** Build-time version metadata (SemVer + git short SHA). */

export type BuildInfo = {
  version: string
  gitSha: string
}

export function getBuildInfo (): BuildInfo {
  return {
    version: __APP_VERSION__,
    gitSha: __APP_GIT_SHA__
  }
}

/** UI label, e.g. `v0.2.0 (79114fd)`. */
export function formatAppVersionLabel (): string {
  const { version, gitSha } = getBuildInfo()
  return `v${version} (${gitSha})`
}
