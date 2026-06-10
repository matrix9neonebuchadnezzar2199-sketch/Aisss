export type PolicyLevel = 'allow' | 'summarize_only' | 'deny'
export type ExportPolicy = 'allow' | 'deny_print' | 'deny_copy' | 'deny_all'

export type ConditionRow = {
  name: string
  search_policy: string
  quote_policy: string
  export_policy: string
  priority: number
}

export type EffectivePolicies = {
  quote_policy: PolicyLevel
  export_policy: ExportPolicy
  condition_names: string[]
}

const QUOTE_RANK: Record<string, number> = {
  allow: 0,
  summarize_only: 1,
  deny: 2
}

const EXPORT_RANK: Record<string, number> = {
  allow: 0,
  deny_print: 1,
  deny_copy: 2,
  deny_all: 3
}

export function isSearchDenied (
  conditions: ConditionRow[],
  _channel = 'webui_chat'
): boolean {
  for (const c of conditions) {
    if (c.search_policy === 'deny') return true
  }
  return false
}

export function computeEffectivePolicies (
  conditions: ConditionRow[]
): EffectivePolicies {
  let quotePolicy: PolicyLevel = 'allow'
  let exportPolicy: ExportPolicy = 'allow'

  for (const c of conditions) {
    // 未知のポリシー文字列は安全側（最も厳しい値）に倒す（fail-closed）
    const qp = c.quote_policy as PolicyLevel
    const qpKnown = QUOTE_RANK[qp] !== undefined
    const qpRank = qpKnown ? QUOTE_RANK[qp] : QUOTE_RANK.deny
    if (qpRank > QUOTE_RANK[quotePolicy]) {
      quotePolicy = qpKnown ? qp : 'deny'
    }
    const ep = c.export_policy as ExportPolicy
    const epKnown = EXPORT_RANK[ep] !== undefined
    const epRank = epKnown ? EXPORT_RANK[ep] : EXPORT_RANK.deny_all
    if (epRank > EXPORT_RANK[exportPolicy]) {
      exportPolicy = epKnown ? ep : 'deny_all'
    }
  }

  return {
    quote_policy: quotePolicy,
    export_policy: exportPolicy,
    condition_names: conditions.map((c) => c.name)
  }
}

export function buildQuoteSystemHint (policies: EffectivePolicies): string {
  if (policies.quote_policy === 'deny') {
    return '引用や逐語転載は禁止です。要約のみ行ってください。'
  }
  if (policies.quote_policy === 'summarize_only') {
    return '長い逐語引用は避け、要約と分析を中心に回答してください。'
  }
  return '出典を明示し、短い引用は可能です。'
}
