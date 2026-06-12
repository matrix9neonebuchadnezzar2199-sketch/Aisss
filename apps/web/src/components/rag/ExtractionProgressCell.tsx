import { useEffect, useMemo, useRef, useState } from 'react'
import type { RagExtractionProgress } from '../../lib/api'
import {
  advanceExtractionProgress,
  estimateExtractionSeconds,
  fallbackExtractionProgress
} from '../../lib/extraction-progress-live'

function formatElapsed (seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatEta (seconds: number): string {
  if (seconds <= 0) return 'まもなく完了'
  if (seconds < 60) return `あと約 ${seconds} 秒`
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  return `あと約 ${minutes} 分`
}

function progressFromElapsed (input: {
  elapsed: number
  estimate: number
  phase: 'queued' | 'running'
}): RagExtractionProgress {
  const { elapsed, estimate, phase } = input
  if (phase === 'queued') {
    return {
      phase: 'queued',
      percent: Math.min(15, 5 + Math.floor(elapsed / 4)),
      eta_seconds: estimate + 20,
      elapsed_seconds: elapsed
    }
  }
  return {
    phase: 'running',
    percent: Math.min(92, Math.max(18, Math.round((elapsed / estimate) * 100))),
    eta_seconds: Math.max(0, estimate - elapsed),
    elapsed_seconds: elapsed
  }
}

type ExtractionProgressCellProps = {
  progress?: RagExtractionProgress | null
  fallbackLabel?: string
  extractionStatus?: string
  fileName?: string
  fileSizeBytes?: number | null
  registeredAt?: string
}

export function ExtractionProgressCell ({
  progress,
  fallbackLabel = '抽出中',
  extractionStatus,
  fileName = '',
  fileSizeBytes,
  registeredAt
}: ExtractionProgressCellProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const progressFetchedAtRef = useRef(Date.now())

  useEffect(() => {
    progressFetchedAtRef.current = Date.now()
  }, [progress, extractionStatus, registeredAt])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const liveProgress = useMemo(() => {
    if (extractionStatus !== 'pending' && extractionStatus !== 'running') {
      return null
    }

    const estimate = estimateExtractionSeconds(fileSizeBytes, fileName)

    if (progress) {
      const extraSeconds = Math.max(
        0,
        Math.floor((nowMs - progressFetchedAtRef.current) / 1000)
      )
      return advanceExtractionProgress(progress, fileSizeBytes, fileName, extraSeconds)
    }

    const startMs = registeredAt
      ? new Date(registeredAt).getTime()
      : progressFetchedAtRef.current
    const elapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000))
    const phase: 'queued' | 'running' =
      extractionStatus === 'running' || elapsed >= 5 ? 'running' : 'queued'
    return progressFromElapsed({ elapsed, estimate, phase })
  }, [
    progress,
    extractionStatus,
    fileName,
    fileSizeBytes,
    registeredAt,
    nowMs
  ])

  const display = liveProgress ?? fallbackExtractionProgress({
    extractionStatus: extractionStatus ?? 'pending',
    fileName,
    fileSizeBytes,
    registeredAt
  }) ?? {
    phase: 'queued' as const,
    percent: 8,
    eta_seconds: 30,
    elapsed_seconds: 0
  }

  const phaseLabel = display.phase === 'queued' ? 'キュー待ち' : '抽出中'

  return (
    <div className="extraction-progress-cell">
      <div className="extraction-progress-meta">
        <span className="extraction-progress-phase">{phaseLabel}</span>
        <span className="extraction-progress-eta">{formatEta(display.eta_seconds)}</span>
      </div>
      <div
        className="extraction-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={display.percent}
        aria-label={`${phaseLabel} ${display.percent}%`}
      >
        <div
          className={`extraction-progress-fill${display.phase === 'queued' ? ' is-queued' : ''}`}
          style={{ width: `${display.percent}%` }}
        />
      </div>
      <span className="extraction-progress-elapsed">
        経過 {formatElapsed(display.elapsed_seconds)}
        {!liveProgress && !progress ? ` · ${fallbackLabel}` : ''}
      </span>
    </div>
  )
}
