type RagDeleteDialogProps = {
  open: boolean
  targetLabel: string
  pending?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function RagDeleteDialog ({
  open,
  targetLabel,
  pending = false,
  onCancel,
  onConfirm
}: RagDeleteDialogProps) {
  if (!open) return null

  return (
    <div
      className="rag-delete-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ragDeleteTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="rag-delete-dialog">
        <h3 id="ragDeleteTitle">⚠ ファイルを削除しますか？</h3>
        <p className="rag-delete-target">{targetLabel}</p>
        <p className="rag-delete-warn">
          登録情報・抽出テキスト・Qdrant ベクタを完全に削除します。この操作は取り消せません。
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
