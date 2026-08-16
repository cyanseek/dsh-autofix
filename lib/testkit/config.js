import z from '@deepseek-ai/schemastery';
const RuleSchema = z.object({
    id: z.string(),
    tool: z.string(),
    action: z.union(['deny', 'error', 'delay', 'abort', 'block']),
    scope: z.union(['all', 'root', 'nested']).default('all'),
    argumentsPattern: z.string().default(''),
    probability: z.number().default(1),
    afterMatches: z.number().default(0),
    every: z.number().default(1),
    maxInjections: z.number().default(1),
    delayMs: z.number().default(1_000),
    message: z.string().default(''),
});
/** Schemastery schema rendered by DSH's plugin settings UI. */
export const Config = z.object({
    enabled: z.boolean().default(false),
    dryRun: z.boolean().default(true),
    seed: z.string().default('dsh-tool-chaos'),
    allowGlobalWildcard: z.boolean().default(false),
    rules: z.array(RuleSchema).default([]),
});
export { resolveConfig } from './options.js';
//# sourceMappingURL=config.js.map