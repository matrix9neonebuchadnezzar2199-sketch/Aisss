import type { RagExtractionProgress } from './api'

/** API の estimateExtractionSeconds と同じヒューリスティック（クライアント側ライブ更新用）。 */
export function estimateExtractionSeconds (
  fileSizeBytes: number | null | undefined,
  fileName: string
): number {
  const mb = Math.max(0.05, (fileSizeBytes ?? 512_000) / (1024 * 1024))
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) {
    return Math.round(Math.max(20, Math.min(900, mb * 50)))
  }
  if (/\.(docx|xlsx|xls|pptx)$/.test(lower)) {
    return Math.round(Math.max(15, Math.min(600, mb * 35)))
  }
  return Math.round(Math.max(10, Math.min(300, mb * 25)))
}

/** API レスポンスが無いとき、登録時刻から推定進捗を組み立てる。 */
export function fallbackExtractionProgress (input: {
  extractionStatus: string
  fileName: string
  fileSizeBytes?: number | null
  registeredAt?: string
}): RagExtractionProgress | null {
  if (input.extractionStatus !== 'pending' && input.extractionStatus !== 'running') {
    return null
  }
  const nowMs = Date.now()
  const startMs = input.registeredAt ? new Date(input.registeredAt).getTime() : nowMs
  const elapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000))
  const estimate = estimateExtractionSeconds(input.fileSizeBytes, input.fileName)
  const queueSlack = 20

  if (input.extractionStatus === 'pending' && elapsed < 5) {
    return {
      phase: 'queued',
      percent: Math.min(15, 5 + Math.floor(elapsed / 4)),
      eta_seconds: estimate + queueSlack,
      elapsed_seconds: elapsed
    }
  }

  const percent = Math.min(92, Math.max(18, Math.round((elapsed / estimate) * 100)))
  return {
    phase: 'running',
    percent,
    eta_seconds: Math.max(0, estimate - elapsed),
    elapsed_seconds: elapsed
  }
}

/** 前回 API 取得値から経過秒数ぶん進捗を進める（ポーリング間の見た目更新）。 */
export function advanceExtractionProgress (
  base: RagExtractionProgress,
  fileSizeBytes: number | null | undefined,
  fileName: string,
  extraElapsedSeconds: number
): RagExtractionProgress {
  const estimate = estimateExtractionSeconds(fileSizeBytes, fileName)
  const elapsed = base.elapsed_seconds + extraElapsedSeconds

  if (base.phase === 'queued') {
    return {
      phase: 'queued',
      percent: Math.min(15, 5 + Math.floor(elapsed / 4)),
      eta_seconds: estimate + 20,
      elapsed_seconds: elapsed
    }
  }

  const percent = Math.min(92, Math.max(18, Math.round((elapsed / estimate) * 100)))
  return {
    phase: 'running',
    percent,
    eta_seconds: Math.max(0, estimate - elapsed),
    elapsed_seconds: elapsed
  }
}
