import { useCallback, useEffect, useState } from 'react'
import { useFilterPanelCollapsed } from './useFilterPanelCollapsed'

const STORAGE_KEY = 'aisss-sidebar-collapsed'

export function useSidebarCollapsed (): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed))
  }, [collapsed])

  return [collapsed, toggle]
}

export function useSearchFilterCollapsed (): [boolean, () => void] {
  return useFilterPanelCollapsed('aisss-search-filter-collapsed')
}
