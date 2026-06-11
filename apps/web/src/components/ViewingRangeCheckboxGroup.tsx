import type { MasterItem } from '../lib/api'

type ViewingRangeCheckboxGroupProps = {
  /** Field anchor id (e.g. for label `htmlFor` on parent). */
  id?: string
  options: MasterItem[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

/** Multi-select viewing ranges as checkboxes (mock `.checkbox-row` pattern). */
export function ViewingRangeCheckboxGroup ({
  id,
  options,
  value,
  onChange,
  disabled = false
}: ViewingRangeCheckboxGroupProps) {
  function toggle (optionId: string, checked: boolean) {
    if (checked) {
      if (value.includes(optionId)) return
      onChange([...value, optionId])
      return
    }
    onChange(value.filter((v) => v !== optionId))
  }

  return (
    <div className="viewing-range-checkboxes" id={id} role="group" aria-label="閲覧範囲">
      <div className="label-row checkbox-row viewing-range-checkbox-row">
        {options.map((option) => (
          <label key={option.id} className="viewing-range-checkbox-item">
            <input
              type="checkbox"
              checked={value.includes(option.id)}
              disabled={disabled}
              onChange={(e) => toggle(option.id, e.target.checked)}
            />
            {option.name}
          </label>
        ))}
      </div>
    </div>
  )
}
