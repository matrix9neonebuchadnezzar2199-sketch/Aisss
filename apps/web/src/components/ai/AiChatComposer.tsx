import { useRef, type KeyboardEvent } from 'react'

type AiChatComposerProps = {
  message: string
  model: string
  models: string[]
  pendingFiles: File[]
  loading: boolean
  disabled: boolean
  onMessageChange: (value: string) => void
  onModelChange: (value: string) => void
  onFilesSelected: (files: FileList | null) => void
  onRemoveFile: (index: number) => void
  onSubmit: () => void
}

export function AiChatComposer ({
  message,
  model,
  models,
  pendingFiles,
  loading,
  disabled,
  onMessageChange,
  onModelChange,
  onFilesSelected,
  onRemoveFile,
  onSubmit
}: AiChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleKeyDown (e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (!disabled && !loading && message.trim()) onSubmit()
    }
  }

  return (
    <div className="ai-composer-wrap">
      <div className="ai-composer-row">
        <div className="ai-composer-box">
          {pendingFiles.length > 0 && (
            <div className="ai-composer-files">
              {pendingFiles.map((file, index) => (
                <span key={`${file.name}-${index}`} className="ai-composer-file-chip">
                  {file.name}
                  <button
                    type="button"
                    aria-label={`${file.name} を削除`}
                    onClick={() => onRemoveFile(index)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="ai-composer-main">
            <button
              type="button"
              className="ai-composer-attach"
              aria-label="ファイルを添付"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
            >
              +
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="upload-zone-file"
              multiple
              disabled={disabled}
              onChange={(e) => {
                onFilesSelected(e.target.files)
                e.target.value = ''
              }}
            />
            <textarea
              className="ai-composer-input"
              rows={1}
              value={message}
              disabled={disabled}
              placeholder="ケース内容について質問…（Ctrl+Enter で送信）"
              onChange={(e) => onMessageChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <select
              className="ai-composer-model"
              value={model}
              disabled={disabled || models.length === 0}
              aria-label="モデル"
              onChange={(e) => onModelChange(e.target.value)}
            >
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <button
          type="button"
          className="ai-composer-send"
          aria-label="送信"
          disabled={disabled || loading || !message.trim()}
          onClick={onSubmit}
        >
          {loading ? '…' : '↑'}
        </button>
      </div>
      <p className="ai-composer-note">
        権限のある資料のみ検索対象。添付ファイルは UI 上の参照用（回答生成 API には未送信）。
      </p>
    </div>
  )
}
