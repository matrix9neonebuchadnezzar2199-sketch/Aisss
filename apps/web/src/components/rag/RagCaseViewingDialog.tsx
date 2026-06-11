type RagCaseViewingDialogProps = {
  open: boolean
  targetLabel: string
  caseDisplayId: string | null
  onClose: () => void
  onOpenCase: () => void
}

export function RagCaseViewingDialog ({
  open,
  targetLabel,
  caseDisplayId,
  onClose,
  onOpenCase
}: RagCaseViewingDialogProps) {
  if (!open) return null

  return (
    <div
      className="rag-delete-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ragCaseViewingTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="rag-delete-dialog">
        <h3 id="ragCaseViewingTitle" style={{ color: 'var(--accent-fg)' }}>
          閲覧範囲はケース単位です
        </h3>
        <p className="rag-delete-target">{targetLabel}</p>
        <p className="rag-delete-warn" style={{ background: 'var(--canvas-inset)', borderColor: 'var(--border-default)' }}>
          ケース添付ファイルの閲覧範囲は親ケースから継承されます。変更する場合はケース登録画面で編集してください。
        </p>
        <div className="rag-delete-actions">
          <button type="button" className="btn btn-sm" onClick={onClose}>
            閉じる
          </button>
          {caseDisplayId && (
            <button type="button" className="btn btn-sm btn-primary" onClick={onOpenCase}>
              ケースを開く
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
