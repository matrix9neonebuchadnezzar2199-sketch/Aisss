import type { ReactNode } from 'react'

/** ケース登録フォームと同型のラベル＋入力グループ */
export function FormGroup ({
  label,
  required,
  wide,
  empty,
  children
}: {
  label: string
  required?: boolean
  wide?: boolean
  /** 未入力のとき薄いピンク背景（ケース登録フォーム） */
  empty?: boolean
  children: ReactNode
}) {
  return (
    <div className={`form-group${wide ? ' form-group-wide' : ''}${empty ? ' form-group-empty' : ' form-group-filled'}`}>
      <label>
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
    </div>
  )
}
