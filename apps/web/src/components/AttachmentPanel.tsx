import { useCallback, useEffect, useRef, useState } from 'react'
import { RegisterDropZone } from './rag/RegisterDropZone'
import {
  downloadAttachment,
  fetchExtractedText,
  retryExtraction,
  getUserId,
  setAttachmentAutoEnableRag,
  uploadAttachment,
  type AttachmentItem,
  type ExtractedText
} from '../lib/api'

type AttachmentPanelProps = {
  caseId: string
  initial?: AttachmentItem[]
}

export function AttachmentPanel ({ caseId, initial = [] }: AttachmentPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<AttachmentItem[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, ExtractedText | null>>({})
  const [autoEnableOnUpload, setAutoEnableOnUpload] = useState(false)

  const refresh = useCallback(async () => {
    const data = await fetch(`/api/cases/${caseId}/attachments`, {
      headers: { 'X-AISSS-User-Id': getUserId() }
    })
    if (data.ok) {
      const body = await data.json() as { items: AttachmentItem[] }
      setItems(body.items)
    }
  }, [caseId])

  // initial は初期表示のみに使い、マウント時に最新一覧へ置き換える
  // （initial を effect 依存にするとデフォルト [] が毎レンダー新参照になり無限更新になる）
  useEffect(() => {
    void refresh().catch(() => {})
  }, [refresh])

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
        await uploadAttachment(caseId, file, autoEnableOnUpload)
      }
      await refresh()
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function showExtracted (attachmentId: string) {
    try {
      const data = await fetchExtractedText(attachmentId)
      setExpanded((prev) => ({ ...prev, [attachmentId]: data }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '抽出テキストの取得に失敗しました')
    }
  }

  async function updateAutoEnable (attachmentId: string, enabled: boolean) {
    try {
      await setAttachmentAutoEnableRag(attachmentId, enabled)
      setItems((prev) => prev.map((item) => (
        item.id === attachmentId
          ? { ...item, auto_enable_rag_on_extraction: enabled }
          : item
      )))
    } catch (e) {
      setError(e instanceof Error ? e.message : '自動RAG設定の更新に失敗しました')
    }
  }

  async function retryFailedExtraction (attachmentId: string) {
    try {
      await retryExtraction(attachmentId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '再抽出の開始に失敗しました')
    }
  }

  return (
    <div className="attachment-panel">
      <h3>添付ファイル</h3>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={autoEnableOnUpload}
          disabled={uploading}
          onChange={(e) => setAutoEnableOnUpload(e.target.checked)}
        />
        抽出成功後に自動でRAG有効化する
      </label>
      <RegisterDropZone
        variant="file"
        multiple
        busy={uploading}
        busyLabel="アップロード中…"
        disabled={uploading}
        inputRef={fileInputRef}
        fileHint="PDF / DOCX / XLSX / TXT（画像・音声は .txt 文字起こし推奨）— 複数可"
        onFiles={(files) => void onFileChange(files)}
      />
      {error && <p className="error">{error}</p>}
      <ul className="attachment-list">
        {items.map((item) => (
          <li key={item.id}>
            <span className={`status status-${item.extraction_status}`}>{item.extraction_status}</span>
            <button
              type="button"
              className="linkish"
              onClick={() => {
                void downloadAttachment(item.id, item.file_name).catch((e: Error) => setError(e.message))
              }}
            >
              {item.file_name}
            </button>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={item.auto_enable_rag_on_extraction === true}
                disabled={item.rag_enabled === true}
                onChange={(e) => void updateAutoEnable(item.id, e.target.checked)}
              />
              抽出後RAG自動ON
            </label>
            {item.extraction_error && (
              <span className="extract-error" title={item.extraction_error}>
                {item.extraction_error.length > 120
                  ? `${item.extraction_error.slice(0, 120)}…`
                  : item.extraction_error}
              </span>
            )}
            <button type="button" onClick={() => void showExtracted(item.id)}>抽出テキスト</button>
            {(item.extraction_status === 'failed') && (
              <button type="button" onClick={() => void retryFailedExtraction(item.id)}>再抽出</button>
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
