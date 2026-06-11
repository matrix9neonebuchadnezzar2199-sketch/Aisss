/** AI チャット推論（stream / 非 stream）の進行中件数。プロセス内メモリのみ。 */

const refCounts = new Map<string, number>()

export function beginAiInference (model: string): void {
  refCounts.set(model, (refCounts.get(model) ?? 0) + 1)
}

export function endAiInference (model: string): void {
  const next = (refCounts.get(model) ?? 1) - 1
  if (next <= 0) {
    refCounts.delete(model)
  } else {
    refCounts.set(model, next)
  }
}

export function getAiInferenceStatus (): { active: boolean; models: string[] } {
  return {
    active: refCounts.size > 0,
    models: [...refCounts.keys()]
  }
}
