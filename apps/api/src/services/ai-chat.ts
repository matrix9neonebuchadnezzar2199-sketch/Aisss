import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { Settings } from '../settings.js'
import type { AuthUser } from '../types/auth.js'
import { AppError } from '../lib/errors.js'
import { buildQuoteSystemHint } from './conditions.js'
import { chatCompletion, chatCompletionStream } from './ollama-client.js'
import { permissionedSearch } from './permissioned-search.js'
import { isAdmin } from './permissions.js'
import { getDefaultChatModel, getModelDefaults } from './model-roles.js'
import { writeAuditLog } from './audit.js'
import { checkOllamaHealth } from './ollama-health.js'

const WEBUI_CHAT_CHANNEL = 'webui_chat'

function buildSystemPrompt (
  contexts: Array<{ citation: string; text: string }>,
  quoteHint: string
): string {
  const contextBlock = contexts.length
    ? contexts.map((c, i) => `[${i + 1}] ${c.citation}\n${c.text}`).join('\n\n')
    : '(関連する許可済み資料は見つかりませんでした)'

  return `あなたは AISSS の権限付き検索アシスタントです。以下のコンテキストのみを根拠に日本語で回答してください。
許可されていない資料について言及したり、存在を示唆したりしないでください。

${quoteHint}

## 許可済みコンテキスト
${contextBlock}`
}

export async function runAiChat (
  pool: pg.Pool,
  settings: Settings,
  user: AuthUser,
  input: { message: string; model?: string; conversation_id?: string }
) {
  const health = await checkOllamaHealth(settings.ollamaBaseUrl)
  if (health.status === 'down') {
    throw new AppError('service_unavailable', 'Ollama is unavailable.', 503)
  }

  const defaults = await getModelDefaults(pool)
  const model = input.model ?? defaults.chat_model
  if (!model) {
    throw new AppError('validation_error', 'No chat model configured.', 400)
  }
  if (
    !isAdmin(user) &&
    defaults.enabled_chat_models.length > 0 &&
    !defaults.enabled_chat_models.includes(model)
  ) {
    throw new AppError('validation_error', 'Selected model is not enabled for chat.', 400)
  }

  const queryId = randomUUID()
  const search = await permissionedSearch(
    pool,
    settings,
    user,
    input.message.trim(),
    8,
    WEBUI_CHAT_CHANNEL
  )
  const quoteHint = buildQuoteSystemHint(search.effective_policies)
  const systemPrompt = buildSystemPrompt(
    search.contexts.map((c) => ({ citation: c.citation, text: c.text })),
    quoteHint
  )

  const answer = await chatCompletion(
    settings.ollamaBaseUrl,
    model,
    systemPrompt,
    input.message.trim()
  )

  await writeAuditLog(pool, {
    userId: user.id,
    action: 'ai.chat',
    resourceType: 'ai_query',
    resourceId: queryId,
    queryId,
    details: {
      model,
      retrieved_case_ids: search.contexts.map((c) => c.case_id).filter(Boolean),
      excluded_counts: search.excluded_counts,
      channel: WEBUI_CHAT_CHANNEL
    }
  })

  return {
    answer,
    model,
    query_id: queryId,
    citations: search.contexts.map((c) => ({
      display_id: c.display_id,
      title: c.title,
      source_type: c.source_type,
      policies: {
        quote_policy: c.policies.quote_policy,
        export_policy: c.policies.export_policy
      }
    })),
    effective_policies: search.effective_policies
  }
}

export async function* streamAiChat (
  pool: pg.Pool,
  settings: Settings,
  user: AuthUser,
  input: { message: string; model?: string }
) {
  const health = await checkOllamaHealth(settings.ollamaBaseUrl)
  if (health.status === 'down') {
    throw new AppError('service_unavailable', 'Ollama is unavailable.', 503)
  }

  const defaults = await getModelDefaults(pool)
  const model = input.model ?? (await getDefaultChatModel(pool))
  if (!model) {
    throw new AppError('validation_error', 'No chat model configured.', 400)
  }
  if (
    !isAdmin(user) &&
    defaults.enabled_chat_models.length > 0 &&
    !defaults.enabled_chat_models.includes(model)
  ) {
    throw new AppError('validation_error', 'Selected model is not enabled for chat.', 400)
  }

  const queryId = randomUUID()
  const search = await permissionedSearch(
    pool,
    settings,
    user,
    input.message.trim(),
    8,
    WEBUI_CHAT_CHANNEL
  )
  const quoteHint = buildQuoteSystemHint(search.effective_policies)
  const systemPrompt = buildSystemPrompt(
    search.contexts.map((c) => ({ citation: c.citation, text: c.text })),
    quoteHint
  )

  await writeAuditLog(pool, {
    userId: user.id,
    action: 'ai.chat',
    resourceType: 'ai_query',
    resourceId: queryId,
    queryId,
    details: {
      model,
      retrieved_case_ids: search.contexts.map((c) => c.case_id).filter(Boolean),
      excluded_counts: search.excluded_counts,
      channel: WEBUI_CHAT_CHANNEL,
      streaming: true,
      phase: 'started'
    }
  })

  yield {
    type: 'meta' as const,
    query_id: queryId,
    model,
    citations: search.contexts.map((c) => ({
      display_id: c.display_id,
      title: c.title,
      source_type: c.source_type,
      policies: c.policies
    })),
    effective_policies: search.effective_policies
  }

  for await (const token of chatCompletionStream(
    settings.ollamaBaseUrl,
    model,
    systemPrompt,
    input.message.trim()
  )) {
    yield { type: 'token' as const, content: token }
  }

  yield { type: 'done' as const }
}
