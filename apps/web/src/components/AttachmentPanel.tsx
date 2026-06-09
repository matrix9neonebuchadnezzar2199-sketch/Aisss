import { useCallback, useEffect, useState } from 'react'
import {
  attachmentDownloadUrl,
  fetchExtractedText,
  retryExtraction,
  getUserId,
  uploadAttachment,
  type AttachmentItem,
  type ExtractedText
} from '../lib/api'

type AttachmentPanelProps = {
  caseId: string
  initial?: AttachmentItem[]
}

export function AttachmentPanel ({ caseId, initial = [] }: AttachmentPanelProps) {
  const [items, setItems] = useState<AttachmentItem[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, ExtractedText | null>>({})

  const refresh = useCallback(async () => {
    const data = await fetch(`/api/cases/${caseId}/attachments`, {
      headers: { 'X-AISSS-User-Id': getUserId() }
    })
    if (data.ok) {
      const body = await data.json() as { items: AttachmentItem[] }
      setItems(body.items)
    }
  }, [caseId])

  useEffect(() => {
    setItems(initial)
  }, [initial])

  useEffect(() => {
    const pending = items.some((i) => i.extraction_status === 'pending' || i.extraction_status === 'running')
    if (!pending) return
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => window.clearInterval(timer)
  }, [items, refresh])

  async function onFileChange (files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        await uploadAttachment(caseId, file)
      }
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function showExtracted (attachmentId: string) {
    const data = await fetchExtractedText(attachmentId)
    setExpanded((prev) => ({ ...prev, [attachmentId]: data }))
  }

  return (
    <div className="attachment-panel">
      <h3>添付ファイル</h3>
      <label className="upload-zone">
        <input
          type="file"
          multiple
          disabled={uploading}
          onChange={(e) => void onFileChange(e.target.files)}
        />
        {uploading ? 'アップロード中…' : 'ファイルを選択（PDF / TXT / DOCX 等）'}
      </label>
      {error && <p className="error">{error}</p>}
      <ul className="attachment-list">
        {items.map((item) => (
          <li key={item.id}>
            <span className={`status status-${item.extraction_status}`}>{item.extraction_status}</span>
            <a href={attachmentDownloadUrl(item.id)} download>{item.file_name}</a>
            {item.extraction_error && <span className="extract-error">{item.extraction_error}</span>}
            <button type="button" onClick={() => void showExtracted(item.id)}>抽出テキスト</button>
            {(item.extraction_status === 'failed') && (
              <button type="button" onClick={() => void retryExtraction(item.id).then(refresh)}>再抽出</button>
            )}
            {expanded[item.id]?.text && (
              <pre className="extract-preview">{expanded[item.id]?.text}</pre>
            )}
            {expanded[item.id] && !expanded[item.id]?.text && (
              <p className="hint">抽出テキストはまだありません。</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
