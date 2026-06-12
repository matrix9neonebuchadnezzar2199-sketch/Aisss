/** 抽出ジョブの ETA 推定（ファイルサイズベースのヒューリスティック）。 */

export type ExtractionProgressPhase = 'queued' | 'running'

export type ExtractionProgress = {
  phase: ExtractionProgressPhase
  /** 0–92 の推定進捗（完了前に 100% にしない） */
  percent: number
  /** 推定残り秒数 */
  eta_seconds: number
  /** ジョブ開始からの経過秒数 */
  elapsed_seconds: number
}

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

export function buildExtractionProgress (input: {
  extraction_status: string
  job_status: string | null
  job_created_at: Date | null
  job_updated_at: Date | null
  file_size_bytes: number | null
  file_name: string
  now?: Date
}): ExtractionProgress | null {
  if (input.extraction_status !== 'pending' && input.extraction_status !== 'running') {
    return null
  }

  const nowMs = (input.now ?? new Date()).getTime()
  const estimate = estimateExtractionSeconds(input.file_size_bytes, input.file_name)
  const queueSlack = 20

  const isQueued =
    input.extraction_status === 'pending' ||
    input.job_status === 'pending' ||
    input.job_status == null

  if (isQueued && input.job_status !== 'running') {
    const createdMs = input.job_created_at?.getTime() ?? nowMs
    const elapsed = Math.max(0, Math.floor((nowMs - createdMs) / 1000))
    return {
      phase: 'queued',
      percent: Math.min(15, 5 + Math.floor(elapsed / 4)),
      eta_seconds: estimate + queueSlack,
      elapsed_seconds: elapsed
    }
  }

  const startedMs = input.job_updated_at?.getTime()
    ?? input.job_created_at?.getTime()
    ?? nowMs
  const elapsed = Math.max(0, Math.floor((nowMs - startedMs) / 1000))
  const percent = Math.min(92, Math.max(18, Math.round((elapsed / estimate) * 100)))
  const eta = Math.max(0, estimate - elapsed)

  return {
    phase: 'running',
    percent,
    eta_seconds: eta,
    elapsed_seconds: elapsed
  }
}
