import { useEffect, useState } from 'react'
import { fetchExtractedText } from '../lib/api'

/** 添付の抽出テキストプレビュー（M23 case detail） */
export function AttachmentExtractPreview ({ attachmentId, fileName }: { attachmentId: string; fileName: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || text !== null) return
    setLoading(true)
    void fetchExtractedText(attachmentId)
      .then((row) => {
        setText(row.text?.trim() || '（抽出テキストなし）')
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, attachmentId, text])

  return (
    <span className="attach-preview-wrap">
      <button type="button" className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
        {open ? 'プレビュー閉じる' : '抽出プレビュー'}
      </button>
      {open && (
        <div className="extract-preview-block" aria-label={`${fileName} 抽出プレビュー`}>
          {loading && <p className="meta">読み込み中…</p>}
          {error && <p className="error">{error}</p>}
          {text && <pre className="extract-preview-text">{text.slice(0, 4000)}{text.length > 4000 ? '\n…（省略）' : ''}</pre>}
        </div>
      )}
    </span>
  )
}
