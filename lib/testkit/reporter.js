/** Cordis loader facade for the stable chaos-decision JSONL reporter. */
import z from '@deepseek-ai/schemastery';
import { applyReporter } from './reporter-runtime.js';
/** Cordis loader metadata for the reporter sub-plugin. */
export const name = 'dsh-tool-chaos-reporter';
/** Schemastery schema rendered by DSH's plugin settings UI. */
export const Config = z.object({
    prefix: z.string().default('DSH_TOOL_CHAOS_EVENT '),
    includeDryRun: z.boolean().default(true),
});
/** Register the machine-readable decision stream. */
export function apply(ctx, config = {}) {
    applyReporter(ctx, config);
}
export { applyReporter, resolveReporterConfig } from './reporter-runtime.js';
//# sourceMappingURL=reporter.js.map