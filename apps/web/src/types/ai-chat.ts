export type AiChatCitation = {
  display_id?: string | null
  title: string
  source_type: string
}

export type AiChatAttachmentMeta = {
  name: string
  size: number
}

export type AiChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  model?: string
  queryId?: string
  citations?: AiChatCitation[]
  attachments?: AiChatAttachmentMeta[]
}

export type AiChatSession = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: AiChatMessage[]
}

export type AiChatHistoryStore = {
  version: 1
  activeSessionId: string | null
  sessions: AiChatSession[]
}
