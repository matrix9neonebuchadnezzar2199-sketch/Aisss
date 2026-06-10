import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getUserId } from '../lib/api'

type RowIssue = { level: string; code: string; message: string }

type PreviewRow = {
  row_number: number
  valid: boolean
  errors: RowIssue[]
  warnings: RowIssue[]
  parsed?: { title?: string; case_uuid?: string | null }
}

type PreviewResult = {
  preview_id: string
  expires_at: string
  summary: {
    total_rows: number
    valid_rows: number
    error_rows: number
    warning_rows: number
  }
  rows: PreviewRow[]
}

type ConfirmResult = {
  import_id: string
  created_count: number
  updated_count: number
  skipped_count: number
  row_results: Array<{
    row_number: number
    status: string
    display_id?: string
    message?: string
  }>
}

async function downloadTemplate () {
  const response = await fetch('/api/imports/excel/template')
  if (!response.ok) throw new Error('Template download failed')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'aisss-cases-template.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

export function ExcelImportPanel () {
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [confirm, setConfirm] = useState<ConfirmResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function uploadPreview (files: FileList | null) {
    if (!files?.[0]) return
    setLoading(true)
    setError(null)
    setConfirm(null)
    try {
      const form = new FormData()
      form.append('file', files[0])
      const response = await fetch('/api/imports/excel/preview', {
        method: 'POST',
        headers: { 'X-AISSS-User-Id': getUserId() },
        body: form
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(body.error?.message ?? `HTTP ${response.status}`)
      }
      setPreview(await response.json() as PreviewResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
  }

  async function runConfirm () {
    if (!preview) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/imports/excel/${preview.preview_id}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AISSS-User-Id': getUserId()
        }
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(body.error?.message ?? `HTTP ${response.status}`)
      }
      setConfirm(await response.json() as ConfirmResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="excel-import-panel">
      <h3>Excel 一括取り込み</h3>
      <p className="hint">
        <button
          type="button"
          className="linkish"
          onClick={() => {
            void downloadTemplate().catch((e: Error) => setError(e.message))
          }}
        >
          テンプレートをダウンロード
        </button>
        （プレビュー → 確認の 2 段階。エラー行はスキップされます）
      </p>
      <label className="upload-zone">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={loading}
          onChange={(e) => void uploadPreview(e.target.files)}
        />
        {loading ? '処理中…' : 'Excel ファイルを選択してプレビュー'}
      </label>
      {error && <p className="error">{error}</p>}

      {preview && (
        <div className="preview-block">
          <p>
            {preview.summary.total_rows} 行 /
            有効 {preview.summary.valid_rows} /
            エラー {preview.summary.error_rows}
          </p>
          <table className="data-table">
            <thead>
              <tr><th>行</th><th>表題</th><th>状態</th><th>メッセージ</th></tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row.row_number}>
                  <td>{row.row_number}</td>
                  <td>{row.parsed?.title ?? '—'}</td>
                  <td>{row.valid ? 'OK' : 'NG'}</td>
                  <td>
                    {[...row.errors, ...row.warnings].map((i) => i.message).join('; ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" disabled={loading || preview.summary.valid_rows === 0} onClick={() => void runConfirm()}>
            有効行を登録する
          </button>
        </div>
      )}

      {confirm && (
        <div className="confirm-block">
          <p>
            完了: 新規 {confirm.created_count} / 更新 {confirm.updated_count} / スキップ {confirm.skipped_count}
          </p>
          <ul>
            {confirm.row_results.filter((r) => r.display_id).map((r) => (
              <li key={r.row_number}>
                行 {r.row_number}: {r.status}{' '}
                {r.display_id && <Link to={`/cases/${r.display_id}`}>{r.display_id}</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
