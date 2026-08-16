import type { ChaosAction, ResolvedConfig } from './options.js';
/** DSH tool pipeline phase used by one action. */
export type ChaosPhase = 'pre' | 'execute' | 'post';
/** Minimum execution identity consumed by the deterministic engine. */
export interface ChaosExecutionLike {
    readonly callId: string;
    readonly rootCallId: string;
    readonly name: string;
    readonly arguments: unknown;
}
/** One emitted dry-run or real injection decision. */
export interface ChaosDecisionEvent {
    readonly plugin: 'dsh-tool-chaos';
    readonly version: 1;
    readonly ruleId: string;
    readonly action: ChaosAction;
    readonly phase: ChaosPhase;
    readonly tool: string;
    readonly callId: string;
    readonly rootCallId: string;
    readonly nested: boolean;
    readonly matchIndex: number;
    readonly triggerIndex: number;
    readonly probability: number;
    readonly sample: number;
    readonly fingerprint: string;
    readonly dryRun: boolean;
    readonly injected: boolean;
    readonly delayMs?: number;
    readonly message: string;
}
/** Per-rule deterministic counters. */
export interface ChaosRuleStats {
    readonly id: string;
    readonly matched: number;
    readonly eligible: number;
    readonly triggered: number;
    readonly injected: number;
    readonly dryRuns: number;
}
/** Read-only engine state for tests and observability adapters. */
export interface ChaosSnapshot {
    readonly enabled: boolean;
    readonly dryRun: boolean;
    readonly seed: string;
    readonly rules: readonly ChaosRuleStats[];
}
/** Stable JSON representation used for argument matching and deterministic sampling. */
export declare function stableStringify(value: unknown): string;
/** Convert a tool-name glob to an anchored regular expression. */
export declare function compileGlob(glob: string): RegExp;
/** Small stable hash suitable for reproducible sampling, not cryptography. */
export declare function fnv1a32(input: string): number;
/** Stateful deterministic rule evaluator. One engine belongs to one plugin activation. */
export declare class ChaosEngine {
    #private;
    constructor(config: ResolvedConfig);
    /**
     * Evaluate an execution at one phase. Rules are ordered; the first rule that
     * actually triggers wins. A matching but unscheduled/unsampled rule does not
     * suppress later rules.
     */
    decide(phase: ChaosPhase, exec: ChaosExecutionLike): ChaosDecisionEvent | undefined;
    snapshot(): ChaosSnapshot;
}
//# sourceMappingURL=core.d.ts.map