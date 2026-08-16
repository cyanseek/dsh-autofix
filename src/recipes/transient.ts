import { failureText } from '../engine/text.js'
import type { AutoFixRecipe, RecoveryInput, RecoveryMatch } from '../engine/types.js'

const STRUCTURED_CODES = new Set([
  'RATE_LIMIT', 'SERVER', 'TIMEOUT', 'TRANSPORT',
  'ECONNRESET', 'EAI_AGAIN', 'ETIMEDOUT',
])
const HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504])

interface TransientMatch extends RecoveryMatch {
  readonly className: string
}

function structuredCode(input: RecoveryInput): string | undefined {
  const code = input.result.error.info?.code
  if (typeof code !== 'string') return undefined
  const normalized = code.toUpperCase().replaceAll('-', '_')
  if (STRUCTURED_CODES.has(normalized)) return normalized
  const status = /^(?:HTTP_?)?(408|429|500|502|503|504)$/.exec(normalized)?.[1]
  return status === undefined ? undefined : `HTTP_${status}`
}

function structuredMetadata(input: RecoveryInput): string | undefined {
  const visit = (value: unknown, depth = 0): string | undefined => {
    if (depth > 2 || value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
    for (const [key, candidate] of Object.entries(value as Record<string, unknown>)) {
      const normalized = key.toLowerCase().replaceAll('_', '').replaceAll('-', '')
      if (['status', 'statuscode', 'httpstatus'].includes(normalized)) {
        const status = typeof candidate === 'number' ? candidate : Number(candidate)
        if (HTTP_STATUS.has(status)) return `HTTP_${status}`
      }
      if (['retryafter', 'retryafterseconds'].includes(normalized)) {
        const seconds = typeof candidate === 'number' ? candidate : Number(candidate)
        if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 120) return 'RETRY_AFTER_BOUNDED'
      }
    }
    for (const candidate of Object.values(value as Record<string, unknown>)) {
      const matched = visit(candidate, depth + 1)
      if (matched !== undefined) return matched
    }
    return undefined
  }
  return visit(input.result.meta)
}

function httpClass(text: string): string | undefined {
  const match = /\bHTTP(?:\/\d(?:\.\d)?)?[ _:-]*(408|429|500|502|503|504)\b/i.exec(text)
  if (match?.[1] === undefined) return undefined
  const status = Number(match[1])
  return HTTP_STATUS.has(status) ? `HTTP_${status}` : undefined
}

function messageClass(text: string): string | undefined {
  if (/\bECONNRESET\b/i.test(text) || /\bconnection (?:was )?reset(?: by peer)?\b/i.test(text)) return 'ECONNRESET'
  if (/\bEAI_AGAIN\b/i.test(text) || /\btemporary (?:DNS failure|failure in name resolution)\b/i.test(text)) return 'EAI_AGAIN'
  if (/\bETIMEDOUT\b/i.test(text) || /\b(?:request|connection|operation|tool) timed out\b/i.test(text)) return 'ETIMEDOUT'
  const retryAfter = /\bretry-after\s*[:=]\s*(\d{1,3})\b/i.exec(text)?.[1]
  if (retryAfter !== undefined && Number(retryAfter) <= 120) return 'RETRY_AFTER_BOUNDED'
  return undefined
}

export const transientRecipe: AutoFixRecipe<TransientMatch> = {
  id: 'transient-tool-error',
  priority: 400,
  match(input) {
    const text = failureText(input.result)
    const className = structuredCode(input) ?? structuredMetadata(input) ?? httpClass(text) ?? messageClass(text)
    return className === undefined ? undefined : { fingerprint: className, className }
  },
  async recover(input, match) {
    if (input.signal.aborted) return undefined
    return {
      summary: `Transient ${match.className} failure; retry once`,
      text: [
        `AutoFix classified this as a transient tool failure (${match.className}).`,
        'Retry the same operation once now without asking the user.',
        'If the retry also fails, change approach and continue with the best available alternative.',
        'Do not retry this exact failure more than once.',
      ].join('\n'),
    }
  },
}
