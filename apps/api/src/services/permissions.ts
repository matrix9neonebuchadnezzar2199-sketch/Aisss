import type { AuthUser } from '../types/auth.js'
import { ALL_USERS_VIEWING_RANGE_ID } from '../lib/viewing-ranges.js'

export function isAdmin (user: AuthUser): boolean {
  return user.role === 'admin'
}

export function isOperator (user: AuthUser): boolean {
  return isAdmin(user) || user.role === 'operator' || user.role === 'reviewer'
}

export function canAccessCase (user: AuthUser, viewingRangeIds: string[]): boolean {
  if (isAdmin(user)) return true
  if (viewingRangeIds.length === 0) return false
  if (viewingRangeIds.includes(ALL_USERS_VIEWING_RANGE_ID)) return true
  return viewingRangeIds.some((id) => user.viewingRangeIds.includes(id))
}
