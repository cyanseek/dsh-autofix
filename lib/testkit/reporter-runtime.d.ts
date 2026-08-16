/** Stable JSONL reporter implementation without schema/runtime dependencies. */
import type { Context } from '@deepseek-ai/cordis';
import './events.js';
/** Public reporter configuration. */
export interface ReporterConfig {
    /** Prefix placed before each JSON object. Default `DSH_TOOL_CHAOS_EVENT `. */
    prefix?: string;
    /** Include dry-run decisions. Default true. */
    includeDryRun?: boolean;
}
export declare function resolveReporterConfig(config?: ReporterConfig): Required<ReporterConfig>;
/** Register the machine-readable decision stream. */
export declare function applyReporter(ctx: Context, config?: ReporterConfig): void;
//# sourceMappingURL=reporter-runtime.d.ts.map