import { CollapsibleFilterPanel } from '../layout/CollapsibleFilterPanel'
import type { MasterPageDef } from '../../lib/master-catalog'
import type { MasterItem } from '../../lib/api'
import { MasterValueList } from './MasterValueList'

type MasterPageSectionProps = {
  page: MasterPageDef
  masters: Record<string, MasterItem[]>
  onMasterChange: (key: string, items: MasterItem[]) => void
  onError: (message: string | null) => void
}

/** 画面単位の折りたたみセクション */
export function MasterPageSection ({
  page,
  masters,
  onMasterChange,
  onError
}: MasterPageSectionProps) {
  const fieldCount = page.fields.length
  const itemCount = page.fields.reduce((sum, field) => sum + (masters[field.key]?.length ?? 0), 0)

  return (
    <CollapsibleFilterPanel
      storageKey={page.storageKey}
      title={`${page.title}（${fieldCount} 項目 · ${itemCount} 候補）`}
      className="master-page-section"
    >
      <div className="master-page-fields">
        {page.fields.map((field) => (
          <MasterValueList
            key={`${page.id}-${field.key}`}
            masterKey={field.key}
            label={field.label}
            items={masters[field.key] ?? []}
            onChange={(items) => onMasterChange(field.key, items)}
            onError={onError}
          />
        ))}
      </div>
    </CollapsibleFilterPanel>
  )
}
