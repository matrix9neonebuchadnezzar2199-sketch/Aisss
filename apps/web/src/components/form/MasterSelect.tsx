import type { MasterItem } from '../../lib/api'

/** マスタ select（— 空選択付き） */
export function MasterSelect ({
  id,
  value,
  options,
  onChange,
  disabled
}: {
  id?: string
  value: string
  options: MasterItem[]
  onChange: (id: string) => void
  disabled?: boolean
}) {
  return (
    <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {options.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  )
}
