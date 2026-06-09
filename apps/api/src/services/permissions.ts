import type { AuthUser } from '../types/auth.js'

export function isAdmin (user: AuthUser): boolean {
  return user.role === 'admin'
}

export function canAccessCase (user: AuthUser, viewingRangeIds: string[]): boolean {
  if (isAdmin(user)) return true
  if (viewingRangeIds.length === 0) return false
  return viewingRangeIds.some((id) => user.viewingRangeIds.includes(id))
}
