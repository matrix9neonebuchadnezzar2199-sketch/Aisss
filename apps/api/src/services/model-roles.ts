import type pg from 'pg'
import { AppError } from '../lib/errors.js'
import { isAdmin } from './permissions.js'
import type { AuthUser } from '../types/auth.js'

export type ModelRoleAssignment = {
  model_name: string
  roles?: string[]
  enabled_for_chat?: boolean
  is_default_chat?: boolean
  is_default_embedding?: boolean
  is_rerank?: boolean
}

export async function getModelDefaults (pool: pg.Pool) {
  const { rows } = await pool.query<{
    model_name: string
    is_default_chat: boolean
    is_default_embedding: boolean
    is_rerank: boolean
    enabled_for_chat: boolean
  }>(
    `SELECT model_name, is_default_chat, is_default_embedding, is_rerank, enabled_for_chat
     FROM ollama_model_roles`
  )
  const chat = rows.find((r) => r.is_default_chat)
  const embedding = rows.find((r) => r.is_default_embedding)
  const rerank = rows.find((r) => r.is_rerank)
  const { rows: settings } = await pool.query<{ value_json: { rerank_enabled?: boolean } }>(
    `SELECT value_json FROM app_settings WHERE key = 'rag'`
  )
  return {
    chat_model: chat?.model_name ?? null,
    embedding_model: embedding?.model_name ?? null,
    rerank_model: rerank?.model_name ?? null,
    rerank_enabled: settings[0]?.value_json?.rerank_enabled ?? false,
    enabled_chat_models: rows.filter((r) => r.enabled_for_chat).map((r) => r.model_name)
  }
}

export async function getDefaultEmbeddingModel (pool: pg.Pool): Promise<string | null> {
  const defaults = await getModelDefaults(pool)
  return defaults.embedding_model
}

export async function getDefaultChatModel (pool: pg.Pool): Promise<string | null> {
  const defaults = await getModelDefaults(pool)
  return defaults.chat_model
}

/** チャット有効 / 既定チャットが DB と異なる割当が含まれるか。 */
export async function chatRolesWouldChange (
  pool: pg.Pool,
  assignments: ModelRoleAssignment[]
): Promise<boolean> {
  const { rows } = await pool.query<{
    model_name: string
    enabled_for_chat: boolean
    is_default_chat: boolean
  }>(
    `SELECT model_name, enabled_for_chat, is_default_chat FROM ollama_model_roles`
  )
  const current = new Map(rows.map((r) => [r.model_name, r]))
  for (const a of assignments) {
    const prev = current.get(a.model_name)
    const nextEnabled = a.enabled_for_chat ?? false
    const nextDefault = a.is_default_chat ?? false
    if (nextEnabled !== (prev?.enabled_for_chat ?? false)) return true
    if (nextDefault !== (prev?.is_default_chat ?? false)) return true
  }
  return false
}

export async function updateModelRoles (
  pool: pg.Pool,
  user: AuthUser,
  input: {
    assignments: ModelRoleAssignment[]
    rerank_enabled?: boolean
  }
) {
  if (!isAdmin(user)) {
    throw new AppError('permission_denied', 'Administrator role required.', 403)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // default はグローバルに1つ。assignments に含まれない残留行（Ollama から消えたモデル等）が
    // default を握り続けないよう、新しい default を立てる前に全行をリセットする。
    if (input.assignments.some((a) => a.is_default_chat)) {
      await client.query(`UPDATE ollama_model_roles SET is_default_chat = FALSE WHERE is_default_chat = TRUE`)
    }
    if (input.assignments.some((a) => a.is_default_embedding)) {
      await client.query(`UPDATE ollama_model_roles SET is_default_embedding = FALSE WHERE is_default_embedding = TRUE`)
    }
    if (input.assignments.some((a) => a.is_rerank)) {
      await client.query(`UPDATE ollama_model_roles SET is_rerank = FALSE WHERE is_rerank = TRUE`)
    }
    for (const a of input.assignments) {
      await client.query(
        `INSERT INTO ollama_model_roles (
          model_name, roles, enabled_for_chat, is_default_chat, is_default_embedding, is_rerank, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (model_name) DO UPDATE SET
          roles = EXCLUDED.roles,
          enabled_for_chat = EXCLUDED.enabled_for_chat,
          is_default_chat = EXCLUDED.is_default_chat,
          is_default_embedding = EXCLUDED.is_default_embedding,
          is_rerank = EXCLUDED.is_rerank,
          updated_at = NOW()`,
        [
          a.model_name,
          a.roles ?? [],
          a.enabled_for_chat ?? false,
          a.is_default_chat ?? false,
          a.is_default_embedding ?? false,
          a.is_rerank ?? false
        ]
      )
    }
    if (input.rerank_enabled !== undefined) {
      await client.query(
        `INSERT INTO app_settings (key, value_json, updated_at)
         VALUES ('rag', jsonb_build_object('rerank_enabled', $1::boolean), NOW())
         ON CONFLICT (key) DO UPDATE SET
           value_json = app_settings.value_json || jsonb_build_object('rerank_enabled', $1::boolean),
           updated_at = NOW()`,
        [input.rerank_enabled]
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return getModelDefaults(pool)
}

/** Ollama から消えたモデルの AISSS ロール行を削除する。 */
export async function removeModelRole (
  pool: pg.Pool,
  user: AuthUser,
  modelName: string
): Promise<void> {
  if (!isAdmin(user)) {
    throw new AppError('permission_denied', 'Administrator role required.', 403)
  }
  await pool.query(`DELETE FROM ollama_model_roles WHERE model_name = $1`, [modelName])
}
