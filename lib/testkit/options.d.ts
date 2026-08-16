/** Faults supported by the first release. Each maps to one DSH pipeline seam. */
export type ChaosAction = 'deny' | 'error' | 'delay' | 'abort' | 'block';
/** Select root model calls, Code Mode/nested calls, or both. */
export type ChaosCallScope = 'all' | 'root' | 'nested';
/** One deterministic fault-injection rule. */
export interface ChaosRule {
    /** Stable identifier used in events, statistics, and deterministic hashing. */
    id: string;
    /** Tool-name glob (`*` and `?` are supported). */
    tool: string;
    /** Fault to inject. */
    action: ChaosAction;
    /** Whether the rule applies to root calls, nested calls, or both. Default `all`. */
    scope?: ChaosCallScope;
    /** Optional regular expression over stable JSON-serialized arguments. */
    argumentsPattern?: string;
    /** Deterministic sampling probability in [0, 1]. Default 1. */
    probability?: number;
    /** Skip this many matching calls before the schedule starts. Default 0. */
    afterMatches?: number;
    /** Trigger on the first eligible match and then every N matches. Default 1. */
    every?: number;
    /** Maximum number of triggers, including dry-run triggers. Default 1. */
    maxInjections?: number;
    /** Delay or abort deadline in milliseconds. Default 1000. */
    delayMs?: number;
    /** Optional model-facing diagnostic. */
    message?: string;
}
/** Public plugin configuration. */
export interface Config {
    /** Master switch. Default false. */
    enabled?: boolean;
    /** Emit exact decisions without changing execution. Default true. */
    dryRun?: boolean;
    /** Seed for deterministic probability sampling. */
    seed?: string;
    /** Permit a rule whose tool glob is exactly `*`. Default false. */
    allowGlobalWildcard?: boolean;
    /** Ordered rule list; first triggered rule wins within each pipeline phase. */
    rules?: ChaosRule[];
}
/** Runtime-normalized rule. */
export interface ResolvedChaosRule {
    id: string;
    tool: string;
    action: ChaosAction;
    scope: ChaosCallScope;
    argumentsPattern: string;
    probability: number;
    afterMatches: number;
    every: number;
    maxInjections: number;
    delayMs: number;
    message: string;
}
/** Runtime-normalized configuration. */
export interface ResolvedConfig {
    enabled: boolean;
    dryRun: boolean;
    seed: string;
    allowGlobalWildcard: boolean;
    rules: ResolvedChaosRule[];
}
/** Validate direct calls as strictly as Loader-resolved configuration. */
export declare function resolveConfig(input?: Config): ResolvedConfig;
//# sourceMappingURL=options.d.ts.map