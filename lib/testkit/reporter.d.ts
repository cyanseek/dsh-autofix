/** Cordis loader facade for the stable chaos-decision JSONL reporter. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type ReporterConfig } from './reporter-runtime.js';
/** Cordis loader metadata for the reporter sub-plugin. */
export declare const name = "dsh-tool-chaos-reporter";
/** Public reporter configuration type paired with the Schemastery value. */
export interface Config extends ReporterConfig {
}
/** Schemastery schema rendered by DSH's plugin settings UI. */
export declare const Config: z<Config>;
/** Register the machine-readable decision stream. */
export declare function apply(ctx: Context, config?: Config): void;
export { applyReporter, resolveReporterConfig } from './reporter-runtime.js';
export type { ReporterConfig } from './reporter-runtime.js';
//# sourceMappingURL=reporter.d.ts.map