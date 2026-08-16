import { Buffer } from 'node:buffer'
import { boundText, failureText } from '../engine/text.js'
import type { AutoFixRecipe, RecoveryInput, RecoveryMatch } from '../engine/types.js'

const PATH_KEYS = new Set(['path', 'file', 'filepath', 'filename', 'target', 'targetpath', 'absolute_path'])
const NEEDLE_KEYS = new Set(['oldstring', 'old_text', 'oldtext', 'search', 'searchtext'])
const MAX_BYTES = 32 * 1024
const MAX_LINES = 80

interface StaleMatch extends RecoveryMatch {
  readonly path?: string
  readonly needle?: string
}

function structuredString(input: unknown, keys: ReadonlySet<string>, depth = 0): string | undefined {
  if (depth > 2 || input === null || typeof input !== 'object') return undefined
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '')
    const normalizedKeys = new Set([...keys].map(item => item.replaceAll('_', '')))
    if (normalizedKeys.has(normalized) && typeof value === 'string' && value.length > 0) return value
  }
  for (const value of Object.values(input as Record<string, unknown>)) {
    const nested = structuredString(value, keys, depth + 1)
    if (nested !== undefined) return nested
  }
  return undefined
}

function staleClass(text: string): string | undefined {
  const signatures: readonly [RegExp, string][] = [
    [/\bold text not found\b/i, 'OLD_TEXT_NOT_FOUND'],
    [/\bstring did not match\b/i, 'STRING_DID_NOT_MATCH'],
    [/\bfile changed since last read\b/i, 'FILE_CHANGED'],
    [/\bstale file\b/i, 'STALE_FILE'],
    [/\bedit conflict\b/i, 'EDIT_CONFLICT'],
    [/\breplacement target not found\b/i, 'REPLACEMENT_NOT_FOUND'],
  ]
  return signatures.find(([signature]) => signature.test(text))?.[1]
}

function sessionCwd(input: RecoveryInput): string | undefined {
  const agent = input.exec.agent as unknown
  if (agent === null || typeof agent !== 'object') return undefined
  const session = (agent as Record<string, unknown>).session
  if (session === null || typeof session !== 'object') return undefined
  const header = (session as Record<string, unknown>).header
  if (header === null || typeof header !== 'object') return undefined
  const cwd = (header as Record<string, unknown>).cwd
  return typeof cwd === 'string' ? cwd : undefined
}

function byteBound(value: string, maximum: number): string {
  if (Buffer.byteLength(value, 'utf8') <= maximum) return value
  let low = 0
  let high = value.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (Buffer.byteLength(value.slice(0, middle), 'utf8') <= maximum) low = middle
    else high = middle - 1
  }
  return value.slice(0, low)
}

async function readBounded(input: RecoveryInput, path: string): Promise<string | undefined> {
  const fs = input.services.fs
  if (fs === undefined || input.signal.aborted) return undefined
  const target = await fs.resolve(path, { cwd: sessionCwd(input), signal: input.signal })
  const info = await fs.stat(target, input.signal)
  if (info?.type !== 'file') return undefined
  if (info.size !== undefined && info.size <= MAX_BYTES) {
    return byteBound(await fs.readText(target, input.signal), MAX_BYTES)
  }
  let text = ''
  const stream = await fs.streamText(target, input.signal)
  for await (const chunk of stream) {
    if (input.signal.aborted) return undefined
    text = byteBound(text + chunk, MAX_BYTES)
    if (Buffer.byteLength(text, 'utf8') >= MAX_BYTES) break
  }
  return text
}

function excerpt(text: string, needle?: string): string {
  const lines = text.split(/\r?\n/)
  let start = 0
  if (needle !== undefined) {
    const line = lines.findIndex(candidate => candidate.includes(needle))
    if (line >= 0) start = Math.max(0, line - Math.floor(MAX_LINES / 2))
  }
  const selected = lines.slice(start, start + MAX_LINES).join('\n')
  const clipped = start > 0 || start + MAX_LINES < lines.length
  return `${start > 0 ? '…\n' : ''}${selected}${clipped ? '\n…' : ''}`
}

export const staleFileRecipe: AutoFixRecipe<StaleMatch> = {
  id: 'stale-file-context',
  priority: 300,
  match(input) {
    const className = staleClass(failureText(input.result))
    if (className === undefined) return undefined
    const path = structuredString(input.exec.arguments, PATH_KEYS)
    const needle = structuredString(input.exec.arguments, NEEDLE_KEYS)
    return {
      fingerprint: `${className}:${path ?? '<unknown>'}`,
      ...(path === undefined ? {} : { path }),
      ...(needle === undefined ? {} : { needle }),
    }
  },
  async recover(input, match) {
    if (input.signal.aborted) return undefined
    let current: string | undefined
    if (match.path !== undefined) {
      try {
        current = await readBounded(input, match.path)
      } catch {
        current = undefined
      }
    }
    if (input.signal.aborted) return undefined
    const instruction = [
      'AutoFix detected that the edit used stale file content.',
      current === undefined
        ? 'Re-read the target file, then redo the intended edit immediately.'
        : 'The current relevant excerpt is included below. Re-read only if more context is needed, then redo the intended edit immediately.',
      'Do not ask the user to resend the error. Do not use a fuzzy replacement.',
    ]
    if (current !== undefined) {
      instruction.push('', `Current excerpt from ${match.path}:`, '```text', excerpt(current, match.needle), '```')
    }
    return {
      summary: current === undefined ? 'Stale edit; re-read and retry' : 'Stale edit; current excerpt refreshed',
      text: boundText(instruction.join('\n'), input.config.maxContextChars),
    }
  },
}
