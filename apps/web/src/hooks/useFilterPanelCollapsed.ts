import { useCallback, useState } from 'react'

/** 折りたたみフィルタパネルの開閉状態（localStorage 永続化） */
export function useFilterPanelCollapsed (storageKey: string, defaultCollapsed = false): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored === null) return defaultCollapsed
    return stored === 'true'
  })

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(storageKey, String(next))
      return next
    })
  }, [storageKey])

  return [collapsed, toggle]
}
