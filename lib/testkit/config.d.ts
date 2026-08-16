import z from '@deepseek-ai/schemastery';
import type { Config as ConfigShape } from './options.js';
/** Public configuration type paired with the Schemastery value below. */
export interface Config extends ConfigShape {
}
/** Schemastery schema rendered by DSH's plugin settings UI. */
export declare const Config: z<Config>;
export { resolveConfig } from './options.js';
export type { ChaosAction, ChaosCallScope, ChaosRule, ResolvedChaosRule, ResolvedConfig, } from './options.js';
//# sourceMappingURL=config.d.ts.map