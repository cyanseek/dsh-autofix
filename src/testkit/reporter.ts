/** Cordis loader facade for the stable chaos-decision JSONL reporter. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { applyReporter, type ReporterConfig } from './reporter-runtime.js'

/** Cordis loader metadata for the reporter sub-plugin. */
export const name = 'dsh-tool-chaos-reporter'

/** Public reporter configuration type paired with the Schemastery value. */
export interface Config extends ReporterConfig {}

/** Schemastery schema rendered by DSH's plugin settings UI. */
export const Config = z.object({
  prefix: z.string().default('DSH_TOOL_CHAOS_EVENT '),
  includeDryRun: z.boolean().default(true),
}) as z<Config>

/** Register the machine-readable decision stream. */
export function apply(ctx: Context, config: Config = {}): void {
  applyReporter(ctx, config)
}

export { applyReporter, resolveReporterConfig } from './reporter-runtime.js'
export type { ReporterConfig } from './reporter-runtime.js'
