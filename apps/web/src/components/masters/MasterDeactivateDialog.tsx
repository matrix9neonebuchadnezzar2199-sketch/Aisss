type MasterDeactivateDialogProps = {
  open: boolean
  fieldLabel: string
  valueName: string
  pending?: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** マスタ候補の無効化（削除）前の重大警告 */
export function MasterDeactivateDialog ({
  open,
  fieldLabel,
  valueName,
  pending = false,
  onCancel,
  onConfirm
}: MasterDeactivateDialogProps) {
  if (!open) return null

  return (
    <div
      className="rag-delete-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="masterDeactivateTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel()
      }}
    >
      <div className="rag-delete-dialog master-deactivate-dialog">
        <h3 id="masterDeactivateTitle">⚠ 候補を削除（無効化）しますか？</h3>
        <p className="rag-delete-target">
          {fieldLabel}：<strong>{valueName}</strong>
        </p>
        <div className="rag-delete-warn master-deactivate-warn">
          <p className="master-deactivate-warn-lead">
            <strong>重大な影響があります。よく確認してから実行してください。</strong>
          </p>
          <ul className="master-deactivate-warn-list">
            <li>登録画面・検索画面の select / チェックボックスからこの候補が消えます。</li>
            <li>
              既にこの値で登録されたケース・参照資料は DB 上に残りますが、
              検索条件として選べなくなるため<strong>マッチング・絞り込みができなくなります</strong>。
            </li>
            <li>名称を変えたいだけなら「削除」ではなく、一覧の名称編集を使ってください。</li>
            <li>無効化後に同じ候補を戻すには、新規追加が必要です（元の ID には復元できません）。</li>
          </ul>
        </div>
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
