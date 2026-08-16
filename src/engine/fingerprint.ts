import { createHash } from 'node:crypto'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import { stableStringify } from './text.js'

let nextAnonymousAgent = 1
const anonymousAgents = new WeakMap<object, number>()

function agentIdentity(agent: unknown): string {
  if (typeof agent !== 'object' || agent === null) return 'direct'
  const record = agent as Record<string, unknown>
  const session = record.session
  if (typeof session === 'object' && session !== null) {
    const header = (session as Record<string, unknown>).header
    if (typeof header === 'object' && header !== null) {
      const id = (header as Record<string, unknown>).id
      if (typeof id === 'string' || typeof id === 'number') return `session:${id}`
    }
  }
  const existing = anonymousAgents.get(agent)
  if (existing !== undefined) return `agent:${existing}`
  const assigned = nextAnonymousAgent++
  anonymousAgents.set(agent, assigned)
  return `agent:${assigned}`
}

/** Stable identity used for success cleanup without inspecting tool arguments. */
export function executionScope(exec: Readonly<ToolExecution>): string {
  return agentIdentity(exec.agent)
}

export function recoveryFingerprint(
  exec: Readonly<ToolExecution>,
  recipeId: string,
  normalizedFailure: string,
): { key: string; scope: string } {
  const scope = executionScope(exec)
  const material = [scope, exec.name, stableStringify(exec.arguments), recipeId, normalizedFailure].join('\u0000')
  return {
    scope,
    key: createHash('sha256').update(material).digest('hex').slice(0, 24),
  }
}
