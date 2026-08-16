import type { ChaosAction, ResolvedChaosRule, ResolvedConfig } from './options.js'

/** DSH tool pipeline phase used by one action. */
export type ChaosPhase = 'pre' | 'execute' | 'post'

/** Minimum execution identity consumed by the deterministic engine. */
export interface ChaosExecutionLike {
  readonly callId: string
  readonly rootCallId: string
  readonly name: string
  readonly arguments: unknown
}

/** One emitted dry-run or real injection decision. */
export interface ChaosDecisionEvent {
  readonly plugin: 'dsh-tool-chaos'
  readonly version: 1
  readonly ruleId: string
  readonly action: ChaosAction
  readonly phase: ChaosPhase
  readonly tool: string
  readonly callId: string
  readonly rootCallId: string
  readonly nested: boolean
  readonly matchIndex: number
  readonly triggerIndex: number
  readonly probability: number
  readonly sample: number
  readonly fingerprint: string
  readonly dryRun: boolean
  readonly injected: boolean
  readonly delayMs?: number
  readonly message: string
}

/** Per-rule deterministic counters. */
export interface ChaosRuleStats {
  readonly id: string
  readonly matched: number
  readonly eligible: number
  readonly triggered: number
  readonly injected: number
  readonly dryRuns: number
}

/** Read-only engine state for tests and observability adapters. */
export interface ChaosSnapshot {
  readonly enabled: boolean
  readonly dryRun: boolean
  readonly seed: string
  readonly rules: readonly ChaosRuleStats[]
}

interface MutableStats {
  matched: number
  eligible: number
  triggered: number
  injected: number
  dryRuns: number
}

interface CompiledRule {
  readonly config: ResolvedChaosRule
  readonly phase: ChaosPhase
  readonly toolPattern: RegExp
  readonly argumentsPattern?: RegExp
  readonly stats: MutableStats
}

/** Stable JSON representation used for argument matching and deterministic sampling. */
export function stableStringify(value: unknown): string {
  const seen = new Set<object>()

  const visit = (candidate: unknown): string => {
    if (candidate === null) return 'null'
    switch (typeof candidate) {
      case 'string': return JSON.stringify(candidate)
      case 'boolean': return candidate ? 'true' : 'false'
      case 'number': {
        if (Number.isNaN(candidate)) return '"<NaN>"'
        if (candidate === Infinity) return '"<Infinity>"'
        if (candidate === -Infinity) return '"<-Infinity>"'
        if (Object.is(candidate, -0)) return '-0'
        return String(candidate)
      }
      case 'undefined': return '"<undefined>"'
      case 'bigint': return JSON.stringify(`<bigint:${candidate.toString()}>`)
      case 'symbol': return JSON.stringify(`<symbol:${candidate.description ?? ''}>`)
      case 'function': return JSON.stringify('<function>')
      case 'object': break
    }

    const object = candidate as object
    if (seen.has(object)) return '"<circular>"'
    seen.add(object)
    try {
      if (Array.isArray(candidate)) {
        return `[${candidate.map(item => visit(item)).join(',')}]`
      }
      const record = candidate as Record<string, unknown>
      return `{${Object.keys(record)
        .sort()
        .map(key => `${JSON.stringify(key)}:${visit(record[key])}`)
        .join(',')}}`
    } finally {
      seen.delete(object)
    }
  }

  return visit(value)
}

/** Convert a tool-name glob to an anchored regular expression. */
export function compileGlob(glob: string): RegExp {
  let source = '^'
  for (const character of glob) {
    if (character === '*') source += '.*'
    else if (character === '?') source += '.'
    else source += character.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  }
  source += '$'
  return new RegExp(source)
}

/** Small stable hash suitable for reproducible sampling, not cryptography. */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function phaseFor(action: ChaosAction): ChaosPhase {
  if (action === 'deny') return 'pre'
  if (action === 'block') return 'post'
  return 'execute'
}

function defaultMessage(rule: ResolvedChaosRule, exec: ChaosExecutionLike): string {
  return `chaos rule "${rule.id}" injected ${rule.action} for tool "${exec.name}"`
}

/** Stateful deterministic rule evaluator. One engine belongs to one plugin activation. */
export class ChaosEngine {
  readonly #config: ResolvedConfig
  readonly #rules: CompiledRule[]

  constructor(config: ResolvedConfig) {
    this.#config = config
    this.#rules = config.rules.map(rule => ({
      config: rule,
      phase: phaseFor(rule.action),
      toolPattern: compileGlob(rule.tool),
      ...(rule.argumentsPattern === '' ? {} : { argumentsPattern: new RegExp(rule.argumentsPattern) }),
      stats: { matched: 0, eligible: 0, triggered: 0, injected: 0, dryRuns: 0 },
    }))
  }

  /**
   * Evaluate an execution at one phase. Rules are ordered; the first rule that
   * actually triggers wins. A matching but unscheduled/unsampled rule does not
   * suppress later rules.
   */
  decide(phase: ChaosPhase, exec: ChaosExecutionLike): ChaosDecisionEvent | undefined {
    if (!this.#config.enabled) return undefined
    const serializedArguments = stableStringify(exec.arguments)
    const nested = exec.callId !== exec.rootCallId

    for (const rule of this.#rules) {
      if (rule.phase !== phase) continue
      if (!rule.toolPattern.test(exec.name)) continue
      if (rule.config.scope === 'root' && nested) continue
      if (rule.config.scope === 'nested' && !nested) continue
      if (rule.argumentsPattern !== undefined && !rule.argumentsPattern.test(serializedArguments)) continue

      rule.stats.matched += 1
      const matchIndex = rule.stats.matched
      if (matchIndex <= rule.config.afterMatches) continue
      if ((matchIndex - rule.config.afterMatches - 1) % rule.config.every !== 0) continue
      if (rule.stats.triggered >= rule.config.maxInjections) continue

      rule.stats.eligible += 1
      const material = [
        this.#config.seed,
        rule.config.id,
        exec.name,
        serializedArguments,
        String(matchIndex),
      ].join('\u0000')
      const hash = fnv1a32(material)
      const sample = hash / 0x1_0000_0000
      if (sample >= rule.config.probability) continue

      rule.stats.triggered += 1
      if (this.#config.dryRun) rule.stats.dryRuns += 1
      else rule.stats.injected += 1

      const message = rule.config.message || defaultMessage(rule.config, exec)
      return Object.freeze({
        plugin: 'dsh-tool-chaos',
        version: 1,
        ruleId: rule.config.id,
        action: rule.config.action,
        phase,
        tool: exec.name,
        callId: exec.callId,
        rootCallId: exec.rootCallId,
        nested,
        matchIndex,
        triggerIndex: rule.stats.triggered,
        probability: rule.config.probability,
        sample,
        fingerprint: hash.toString(16).padStart(8, '0'),
        dryRun: this.#config.dryRun,
        injected: !this.#config.dryRun,
        ...(['delay', 'abort'].includes(rule.config.action) ? { delayMs: rule.config.delayMs } : {}),
        message,
      })
    }

    return undefined
  }

  snapshot(): ChaosSnapshot {
    return Object.freeze({
      enabled: this.#config.enabled,
      dryRun: this.#config.dryRun,
      seed: this.#config.seed,
      rules: Object.freeze(this.#rules.map(rule => Object.freeze({
        id: rule.config.id,
        matched: rule.stats.matched,
        eligible: rule.stats.eligible,
        triggered: rule.stats.triggered,
        injected: rule.stats.injected,
        dryRuns: rule.stats.dryRuns,
      }))),
    })
  }
}
