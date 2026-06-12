import { useRef, useState, type DragEvent, type InputHTMLAttributes, type RefObject } from 'react'
import { formatBytes } from '../../lib/folder-files'

type RegisterDropZoneProps = {
  variant: 'file' | 'folder'
  disabled?: boolean
  /** アップロード中等 — ゾーンを無効化してラベル表示 */
  busy?: boolean
  busyLabel?: string
  /** 複数ファイル選択（ケース添付など） */
  multiple?: boolean
  /** 選択済みファイル名（file モード・単一） */
  selectedFile?: File | null
  inputRef?: RefObject<HTMLInputElement | null>
  inputProps?: InputHTMLAttributes<HTMLInputElement>
  onFiles: (files: FileList) => void
  /** フォルダ D&D など DataTransfer 全体が必要なとき */
  onDropEvent?: (e: DragEvent) => void | Promise<void>
  onBrowseClick?: () => void
  /** file モード用ヒント（未指定時は既定文案） */
  fileHint?: string
}

function FileIcon () {
  return (
    <svg className="register-drop-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M14 6h14l10 10v26a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"
        fill="currentColor"
        opacity="0.25"
      />
      <path d="M28 6v10h10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 28h16M16 34h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function FolderIcon () {
  return (
    <svg className="register-drop-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M6 14a4 4 0 0 1 4-4h10l4 4h18a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V14z"
        fill="currentColor"
        opacity="0.25"
      />
      <path d="M6 18h36" stroke="currentColor" strokeWidth="2" />
      <path d="M18 28h12M18 34h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function RegisterDropZone ({
  variant,
  disabled = false,
  busy = false,
  busyLabel = '処理中…',
  multiple = false,
  selectedFile = null,
  inputRef: externalInputRef,
  inputProps,
  onFiles,
  onDropEvent,
  onBrowseClick,
  fileHint
}: RegisterDropZoneProps) {
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef = externalInputRef ?? internalRef
  const [dragOver, setDragOver] = useState(false)

  const isFile = variant === 'file'
  const isDisabled = disabled || busy
  const hasSelection = isFile && !multiple && selectedFile != null
  const defaultFileHint = multiple
    ? 'PDF / DOCX / XLSX / TXT など（複数可）'
    : 'PDF / DOCX / XLSX / TXT など'
  const hintText = fileHint ?? defaultFileHint

  function openPicker () {
    if (isDisabled) return
    if (onBrowseClick) {
      onBrowseClick()
      return
    }
    inputRef.current?.click()
  }

  function handleDragOver (e: DragEvent) {
    e.preventDefault()
    if (!isDisabled) setDragOver(true)
  }

  function handleDrop (e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (isDisabled) return
    if (onDropEvent) {
      void onDropEvent(e)
      return
    }
    const list = e.dataTransfer.files
    if (list.length > 0) onFiles(list)
  }

  function handleInputChange (files: FileList | null) {
    if (!files || files.length === 0) return
    onFiles(files)
  }

  const zoneClass = [
    'register-drop-zone',
    isFile ? 'register-drop-zone--file' : 'register-drop-zone--folder',
    dragOver ? 'drag-over' : '',
    hasSelection ? 'has-selection' : '',
    busy ? 'is-busy' : ''
  ].filter(Boolean).join(' ')

  return (
    <div
      className={zoneClass}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        openPicker()
      }}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openPicker()
        }
      }}
      aria-disabled={isDisabled}
      aria-busy={busy}
    >
      <input
        ref={inputRef}
        type="file"
        className="upload-zone-file"
        disabled={isDisabled}
        multiple={multiple || inputProps?.multiple}
        onChange={(e) => handleInputChange(e.target.files)}
        {...inputProps}
      />

      <div className="register-drop-visual">
        {isFile ? <FileIcon /> : <FolderIcon />}
      </div>

      <div className="register-drop-copy">
        {busy ? (
          <>
            <p className="register-drop-title">{busyLabel}</p>
            <p className="register-drop-hint">完了までお待ちください</p>
          </>
        ) : hasSelection ? (
          <>
            <p className="register-drop-title">{selectedFile.name}</p>
            <p className="register-drop-meta">{formatBytes(selectedFile.size)}</p>
            <p className="register-drop-hint">クリックまたはドロップでファイルを差し替え</p>
          </>
        ) : (
          <>
            <p className="register-drop-title">
              {dragOver
                ? (isFile ? 'ここにドロップ' : 'フォルダをドロップ')
                : (isFile ? 'ファイルをドラッグ＆ドロップ' : 'フォルダをドラッグ＆ドロップ')}
            </p>
            <p className="register-drop-hint">
              {isFile
                ? hintText
                : 'サブフォルダ内のファイルもまとめて読み込みます'}
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        className={`btn btn-sm${isFile ? '' : ' btn-primary'} register-drop-browse`}
        disabled={isDisabled}
        onClick={(e) => {
          e.stopPropagation()
          openPicker()
        }}
      >
        {busy
          ? busyLabel
          : isFile
            ? (hasSelection ? '別のファイルを選択' : (multiple ? 'ファイルを選択（複数可）' : 'ファイルを選択'))
            : 'フォルダを選択'}
      </button>
    </div>
  )
}
