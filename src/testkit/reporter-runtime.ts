/** Stable JSONL reporter implementation without schema/runtime dependencies. */

import process from 'node:process'
import type { Context } from '@deepseek-ai/cordis'
import './events.js'
import type { ChaosDecisionEvent } from './core.js'

/** Public reporter configuration. */
export interface ReporterConfig {
  /** Prefix placed before each JSON object. Default `DSH_TOOL_CHAOS_EVENT `. */
  prefix?: string
  /** Include dry-run decisions. Default true. */
  includeDryRun?: boolean
}

export function resolveReporterConfig(config: ReporterConfig = {}): Required<ReporterConfig> {
  const prefix = config.prefix ?? 'DSH_TOOL_CHAOS_EVENT '
  const includeDryRun = config.includeDryRun ?? true
  if (prefix.length === 0 || prefix.length > 128 || /[\r\n]/.test(prefix)) {
    throw new Error('dsh-tool-chaos-reporter: prefix must contain 1..128 characters and no line breaks')
  }
  return { prefix, includeDryRun }
}

/** Register the machine-readable decision stream. */
export function applyReporter(ctx: Context, config: ReporterConfig = {}): void {
  const resolved = resolveReporterConfig(config)
  ctx.on('tool-chaos/decision', (decision: ChaosDecisionEvent): void => {
    if (decision.dryRun && !resolved.includeDryRun) return
    process.stderr.write(`${resolved.prefix}${JSON.stringify(decision)}\n`)
  })
}
