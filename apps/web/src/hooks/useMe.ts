import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export type MeResponse = {
  user_id: string
  display_name: string
  department_id: string | null
  role: string
  groups: string[]
  viewing_range_ids: string[]
}

export function useMe (): MeResponse | null {
  const [me, setMe] = useState<MeResponse | null>(null)
  useEffect(() => {
    void apiFetch<MeResponse>('/api/me').then(setMe).catch(() => setMe(null))
  }, [])
  return me
}
