export type AuthUser = {
  id: string
  externalId: string | null
  displayName: string
  departmentId: string | null
  role: string
  groupIds: string[]
  viewingRangeIds: string[]
}
