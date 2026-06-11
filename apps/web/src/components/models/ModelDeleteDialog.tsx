type ModelDeleteDialogProps = {
  open: boolean
  targetLabel: string
  pending?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ModelDeleteDialog ({
  open,
  targetLabel,
  pending = false,
  onCancel,
  onConfirm
}: ModelDeleteDialogProps) {
  if (!open) return null

  return (
    <div
      className="rag-delete-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="modelDeleteTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="rag-delete-dialog">
        <h3 id="modelDeleteTitle">ホスト Ollama からモデルを削除しますか？</h3>
        <p className="rag-delete-target">{targetLabel}</p>
        <p className="rag-delete-warn">
          端末（ホスト Ollama）上のモデルファイルを削除します。AISSS のロール設定も消えます。pull で再取得するまで復元できません。
        </p>
        <div className="rag-delete-actions">
          <button type="button" className="btn btn-sm" onClick={onCancel} disabled={pending}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? '削除中…' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  )
}
