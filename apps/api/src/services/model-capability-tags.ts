/** Ollama モデル名 + details から UI 用 capability タグを推定（ヒューリスティック）。 */

export type ModelCapabilityTagId =
  | 'text'
  | 'embed'
  | 'audio'
  | 'vision'
  | 'moe'
  | 'rerank'
  | 'cloud'

export type ModelCapabilityTag = {
  id: ModelCapabilityTagId
  label: string
}

const TAG_LABELS: Record<ModelCapabilityTagId, string> = {
  text: 'テキスト',
  embed: 'Embed',
  audio: '音声',
  vision: '画像',
  moe: 'MoE',
  rerank: 'ReRank',
  cloud: 'Cloud'
}

type Details = {
  family?: string
  families?: string[]
} | null | undefined

function haystack (name: string, details: Details): string {
  const parts = [name, details?.family, ...(details?.families ?? [])]
  return parts.filter(Boolean).join(' ').toLowerCase()
}

export function inferModelCapabilityTags (
  name: string,
  details: Details
): ModelCapabilityTag[] {
  const h = haystack(name, details)
  const ids = new Set<ModelCapabilityTagId>()

  if (/:cloud\b|remote|api-only/.test(h)) {
    ids.add('cloud')
  }
  if (/embed|embedding|nomic-embed|bge-m3|bge-large|e5-|minilm|mxbai-embed|snowflake-arctic-embed|granite-embedding|jina-embed/.test(h)) {
    ids.add('embed')
  }
  if (/rerank|cross-encoder|bge-reranker/.test(h)) {
    ids.add('rerank')
  }
  if (/whisper|parler|audio|speech|cosyvoice|xtts|canary|voxtral/.test(h)) {
    ids.add('audio')
  }
  if (/vision|[-/]vl|llava|moondream|bakllava|minicpm-v|pixtral|fuyu|gemma.*vision|llama.*vision|qwen.*vl|internvl|cogvlm/.test(h)) {
    ids.add('vision')
  }
  if (/\bmoe\b|:moe|mixtral|qwen.*moe|deepseek-v2|dbrx|jamba|granite.*moe|switch-transformer|experts-/.test(h)) {
    ids.add('moe')
  }

  const embedOnly = ids.has('embed') && !ids.has('vision') && !ids.has('audio') && !ids.has('moe')
  const rerankOnly = ids.has('rerank') && ids.size === 1
  if (!embedOnly && !rerankOnly && !ids.has('audio')) {
    ids.add('text')
  }

  const order: ModelCapabilityTagId[] = [
    'text',
    'embed',
    'vision',
    'audio',
    'moe',
    'rerank',
    'cloud'
  ]
  return order
    .filter((id) => ids.has(id))
    .map((id) => ({ id, label: TAG_LABELS[id] }))
}
