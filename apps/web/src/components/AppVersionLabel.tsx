import { formatAppVersionLabel, getBuildInfo } from '../lib/buildInfo'

/** Footer / header build label — confirms deployed UI matches git. */
export function AppVersionLabel ({ className }: { className?: string }) {
  const { version, gitSha } = getBuildInfo()
  const label = formatAppVersionLabel()

  return (
    <span
      className={className ?? 'app-version-label'}
      title={`AISSS Web UI ${version} · commit ${gitSha}`}
    >
      {label}
    </span>
  )
}
