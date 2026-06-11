type ReindexConfirmDialogProps = {
  open: boolean
  targetLabel: string
  pending?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ReindexConfirmDialog ({
  open,
  targetLabel,
  pending = false,
  onCancel,
  onConfirm
}: ReindexConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="rag-delete-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reindexConfirmTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel()
      }}
    >
      <div className="rag-delete-dialog">
        <h3 id="reindexConfirmTitle">Embedding モデルを変更しますか？</h3>
        <p className="rag-delete-target">{targetLabel}</p>
        <p className="rag-delete-warn">
          Embedding モデルを変更すると、新しいベクトル空間で全チャンクの再埋め込み（reindex）が必要です。
          完了するまで旧モデルで検索を継続し、完了後に自動で切り替わります。
        </p>
        <div className="rag-delete-actions">
          <button type="button" className="btn btn-sm" onClick={onCancel} disabled={pending}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? '開始中…' : '再埋め込みを開始'}
          </button>
        </div>
      </div>
    </div>
  )
}
