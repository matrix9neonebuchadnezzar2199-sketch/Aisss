import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AiChatMessage, AiChatSession, AiChatHistoryStore } from '../types/ai-chat'

const STORAGE_VERSION = 1
const MAX_SESSIONS = 50

function storageKey (userId: string) {
  return `aisss-ai-chat-history:${userId}`
}

function loadStore (userId: string): AiChatHistoryStore {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) {
      return { version: STORAGE_VERSION, activeSessionId: null, sessions: [] }
    }
    const parsed = JSON.parse(raw) as AiChatHistoryStore
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.sessions)) {
      return { version: STORAGE_VERSION, activeSessionId: null, sessions: [] }
    }
    return parsed
  } catch {
    return { version: STORAGE_VERSION, activeSessionId: null, sessions: [] }
  }
}

function saveStore (userId: string, store: AiChatHistoryStore) {
  localStorage.setItem(storageKey(userId), JSON.stringify(store))
}

function newSession (): AiChatSession {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: '新しいチャット',
    createdAt: now,
    updatedAt: now,
    messages: []
  }
}

function titleFromMessage (text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (!trimmed) return '新しいチャット'
  return trimmed.length > 36 ? `${trimmed.slice(0, 36)}…` : trimmed
}

export function useAiChatHistory (userId: string | undefined) {
  const [store, setStore] = useState<AiChatHistoryStore>(() => (
    userId ? loadStore(userId) : { version: STORAGE_VERSION, activeSessionId: null, sessions: [] }
  ))

  useEffect(() => {
    if (!userId) return
    setStore(loadStore(userId))
  }, [userId])

  const persist = useCallback((next: AiChatHistoryStore) => {
    setStore(next)
    if (userId) saveStore(userId, next)
  }, [userId])

  const sessions = useMemo(
    () => [...store.sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [store.sessions]
  )

  const activeSession = useMemo(
    () => store.sessions.find((s) => s.id === store.activeSessionId) ?? null,
    [store.sessions, store.activeSessionId]
  )

  const ensureActiveSession = useCallback(() => {
    if (!userId) return null
    if (activeSession) return activeSession
    const session = newSession()
    const next: AiChatHistoryStore = {
      version: STORAGE_VERSION,
      activeSessionId: session.id,
      sessions: [session, ...store.sessions].slice(0, MAX_SESSIONS)
    }
    persist(next)
    return session
  }, [activeSession, persist, store.sessions, userId])

  const startNewSession = useCallback(() => {
    if (!userId) return
    const session = newSession()
    persist({
      version: STORAGE_VERSION,
      activeSessionId: session.id,
      sessions: [session, ...store.sessions].slice(0, MAX_SESSIONS)
    })
  }, [persist, store.sessions, userId])

  const selectSession = useCallback((sessionId: string) => {
    persist({ ...store, activeSessionId: sessionId })
  }, [persist, store])

  const deleteSession = useCallback((sessionId: string) => {
    const remaining = store.sessions.filter((s) => s.id !== sessionId)
    let activeSessionId = store.activeSessionId
    if (activeSessionId === sessionId) {
      activeSessionId = remaining[0]?.id ?? null
      if (!activeSessionId && userId) {
        const fresh = newSession()
        remaining.unshift(fresh)
        activeSessionId = fresh.id
      }
    }
    persist({
      version: STORAGE_VERSION,
      activeSessionId,
      sessions: remaining.slice(0, MAX_SESSIONS)
    })
  }, [persist, store, userId])

  const appendToActiveSession = useCallback((messages: AiChatMessage[]) => {
    if (!userId || messages.length === 0) return null
    let session = store.sessions.find((s) => s.id === store.activeSessionId)
    if (!session) {
      session = newSession()
    }
    const now = new Date().toISOString()
    const firstUser = messages.find((m) => m.role === 'user')
    const title = session.messages.length === 0 && firstUser
      ? titleFromMessage(firstUser.content)
      : session.title

    const updated: AiChatSession = {
      ...session,
      title,
      updatedAt: now,
      messages: [...session.messages, ...messages]
    }

    const others = store.sessions.filter((s) => s.id !== updated.id)
    persist({
      version: STORAGE_VERSION,
      activeSessionId: updated.id,
      sessions: [updated, ...others].slice(0, MAX_SESSIONS)
    })
    return updated
  }, [persist, store.activeSessionId, store.sessions, userId])

  return {
    sessions,
    activeSession,
    activeSessionId: store.activeSessionId,
    ensureActiveSession,
    startNewSession,
    selectSession,
    deleteSession,
    appendToActiveSession
  }
}
