/** Optional internal tuning. The default installation uses an empty config. */
export interface Config {
  enabled?: boolean
  maxInterventionsPerFingerprint?: number
  fingerprintTtlMs?: number
  maxContextChars?: number
  commandCacheTtlMs?: number
  debug?: boolean
}

export interface ResolvedConfig {
  enabled: boolean
  maxInterventionsPerFingerprint: number
  fingerprintTtlMs: number
  maxContextChars: number
  commandCacheTtlMs: number
  debug: boolean
}

function integer(name: string, value: number, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`dsh-autofix: ${name} must be an integer in ${minimum}..${maximum}`)
  }
  return value
}

export function resolveConfig(input: Config = {}): ResolvedConfig {
  const resolved: ResolvedConfig = {
    enabled: input.enabled ?? true,
    maxInterventionsPerFingerprint: input.maxInterventionsPerFingerprint ?? 1,
    fingerprintTtlMs: input.fingerprintTtlMs ?? 120_000,
    maxContextChars: input.maxContextChars ?? 8_000,
    commandCacheTtlMs: input.commandCacheTtlMs ?? 60_000,
    debug: input.debug ?? false,
  }
  if (typeof resolved.enabled !== 'boolean') throw new Error('dsh-autofix: enabled must be a boolean')
  if (typeof resolved.debug !== 'boolean') throw new Error('dsh-autofix: debug must be a boolean')
  integer('maxInterventionsPerFingerprint', resolved.maxInterventionsPerFingerprint, 1, 10)
  integer('fingerprintTtlMs', resolved.fingerprintTtlMs, 1_000, 3_600_000)
  integer('maxContextChars', resolved.maxContextChars, 256, 32_000)
  integer('commandCacheTtlMs', resolved.commandCacheTtlMs, 1_000, 3_600_000)
  return Object.freeze(resolved)
}
