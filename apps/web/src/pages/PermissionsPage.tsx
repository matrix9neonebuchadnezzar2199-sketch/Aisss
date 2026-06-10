import { useEffect, useState } from 'react'
import {
  createGroup,
  fetchGroups,
  fetchUsers,
  fetchViewingRangesWithGroups,
  updateGroupMembers,
  updateViewingRangeGroups,
  type GroupRow,
  type UserRow,
  type ViewingRangeRow
} from '../lib/api'

type PermTab = 'users' | 'groups' | 'mapping'

export function PermissionsPage () {
  const [tab, setTab] = useState<PermTab>('users')
  const [users, setUsers] = useState<UserRow[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [ranges, setRanges] = useState<ViewingRangeRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [userQuery, setUserQuery] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [mappingDraft, setMappingDraft] = useState<Record<string, string[]>>({})

  async function reload () {
    const [u, g, r] = await Promise.all([
      fetchUsers(userQuery || undefined),
      fetchGroups(),
      fetchViewingRangesWithGroups()
    ])
    setUsers(u.items)
    setGroups(g.items)
    setRanges(r.items)
    const draft: Record<string, string[]> = {}
    for (const row of r.items) {
      draft[row.id] = [...(row.group_ids ?? [])]
    }
    setMappingDraft(draft)
  }

  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message))
  }, [])

  async function searchUsers () {
    try {
      const u = await fetchUsers(userQuery || undefined)
      setUsers(u.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ユーザー取得失敗')
    }
  }

  async function saveMapping () {
    setError(null)
    setNotice(null)
    try {
      for (const range of ranges) {
        await updateViewingRangeGroups(range.id, mappingDraft[range.id] ?? [])
      }
      setNotice('マッピングを保存しました')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失敗')
    }
  }

  async function addGroup () {
    if (!newGroupName.trim()) return
    try {
      await createGroup(newGroupName.trim())
      setNewGroupName('')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'グループ作成失敗')
    }
  }

  async function editUserGroups (user: UserRow) {
    const groupId = window.prompt(
      `ユーザー ${user.display_name} の所属グループ ID（カンマ区切り）`,
      groups.filter((g) => g.members.some((m) => m.user_id === user.id)).map((g) => g.id).join(',')
    )
    if (groupId === null) return
    const ids = groupId.split(',').map((s) => s.trim()).filter(Boolean)
    try {
      for (const g of groups) {
        const memberIds = g.members.map((m) => m.user_id)
        const shouldHave = ids.includes(g.id)
        const has = memberIds.includes(user.id)
        if (shouldHave && !has) {
          await updateGroupMembers(g.id, [...memberIds, user.id])
        } else if (!shouldHave && has) {
          await updateGroupMembers(g.id, memberIds.filter((id) => id !== user.id))
        }
      }
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失敗')
    }
  }

  function groupNamesForUser (userId: string): string {
    return groups
      .filter((g) => g.members.some((m) => m.user_id === userId))
      .map((g) => g.name)
      .join(', ') || '—'
  }

  return (
    <section className="view active" id="view-permissions">
      <div className="panel">
        <div className="panel-header">
          <h2>ユーザー・グループ管理</h2>
          <span className="label label-info">閲覧範囲 ↔ グループ連携</span>
        </div>
        <div className="panel-body">
          <p className="rag-register-note" style={{ marginBottom: 12 }}>
            閲覧範囲の<strong>名称</strong>はマスタ管理で定義し、ここでは<strong>どのグループがどの閲覧範囲にアクセスできるか</strong>を設定します。
          </p>

          {error && <p className="error">{error}</p>}
          {notice && <p className="meta">{notice}</p>}

          <div className="perm-tabs" role="tablist">
            <button type="button" className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>ユーザー</button>
            <button type="button" className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>グループ</button>
            <button type="button" className={tab === 'mapping' ? 'active' : ''} onClick={() => setTab('mapping')}>閲覧範囲マッピング</button>
          </div>

          {tab === 'users' && (
            <div className="perm-panel active">
              <div className="filter-bar" style={{ marginBottom: 12 }}>
                <input type="search" placeholder="ユーザー検索…" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
                <button type="button" className="btn btn-sm" onClick={() => void searchUsers()}>検索</button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">氏名</th>
                    <th scope="col">部署</th>
                    <th scope="col">ロール</th>
                    <th scope="col">所属グループ</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.display_name}</td>
                      <td>{u.department_name ?? '—'}</td>
                      <td>{u.role}</td>
                      <td>{groupNamesForUser(u.id)}</td>
                      <td><button type="button" className="btn btn-sm" onClick={() => void editUserGroups(u)}>編集</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'groups' && (
            <div className="perm-panel active">
              <div className="filter-bar" style={{ marginBottom: 12 }}>
                <input placeholder="新規グループ名" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                <button type="button" className="btn btn-sm btn-primary" onClick={() => void addGroup()}>+ グループ</button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">グループ名</th>
                    <th scope="col">メンバー数</th>
                    <th scope="col">メンバー</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.id}>
                      <td>{g.name}</td>
                      <td>{g.members.length}</td>
                      <td>{g.members.map((m) => m.display_name).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'mapping' && (
            <div className="perm-panel active">
              <table className="perm-mapping-table">
                <thead>
                  <tr>
                    <th scope="col">閲覧範囲（マスタ）</th>
                    <th scope="col">許可グループ</th>
                  </tr>
                </thead>
                <tbody>
                  {ranges.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong></td>
                      <td>
                        <select
                          multiple
                          style={{ minWidth: 200 }}
                          value={mappingDraft[r.id] ?? []}
                          onChange={(e) => {
                            const ids = Array.from(e.target.selectedOptions, (o) => o.value)
                            setMappingDraft((prev) => ({ ...prev, [r.id]: ids }))
                          }}
                        >
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => void saveMapping()}>
                マッピングを保存
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
