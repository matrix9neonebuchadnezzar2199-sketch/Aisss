import type { ReactNode } from 'react'

/** ケース登録フォームと同型のラベル＋入力グループ */
export function FormGroup ({
  label,
  required,
  wide,
  children
}: {
  label: string
  required?: boolean
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={`form-group${wide ? ' form-group-wide' : ''}`}>
      <label>
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
    </div>
  )
}
