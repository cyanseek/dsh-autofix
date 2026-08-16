import z from '@deepseek-ai/schemastery'
import type { Config as ConfigShape } from './options.js'

export interface Config extends ConfigShape {}

export const Config = z.object({
  enabled: z.boolean().default(true),
  maxInterventionsPerFingerprint: z.number().default(1),
  fingerprintTtlMs: z.number().default(120_000),
  maxContextChars: z.number().default(8_000),
  commandCacheTtlMs: z.number().default(60_000),
  debug: z.boolean().default(false),
}) as z<Config>

export { resolveConfig } from './options.js'
