/** Runtime build metadata from container env (see docs/21-versioning.md). */

export type BuildInfo = {
  version: string
  gitSha: string
}

export function getBuildInfo (): BuildInfo {
  return {
    version: process.env.AISSS_VERSION ?? '0.0.0',
    gitSha: process.env.AISSS_GIT_SHA ?? 'dev'
  }
}
