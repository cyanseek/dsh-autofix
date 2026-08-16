import type { Context } from '@deepseek-ai/cordis';
import type { ToolExecution, ToolExecutionFailure } from '@deepseek-ai/dsh-tools';
import type { ResolvedConfig } from '../options.js';
/** The small public filesystem surface AutoFix can use when DSH provides it. */
export interface AutoFixFileSystem {
    resolve(path: string, opts?: {
        cwd?: string;
        signal?: AbortSignal;
    }): Promise<unknown>;
    stat(target: unknown, signal?: AbortSignal): Promise<{
        type: 'file' | 'directory' | 'other';
        size?: number;
    } | undefined>;
    readText(target: unknown, signal?: AbortSignal): Promise<string>;
    streamText(target: unknown, signal?: AbortSignal): Promise<AsyncIterable<string>>;
}
/** Runtime services are injectable so every recipe remains deterministic in tests. */
export interface RecoveryServices {
    readonly fs?: AutoFixFileSystem;
    readonly commandExists: (command: string, signal: AbortSignal) => Promise<boolean>;
    readonly platform: NodeJS.Platform;
    readonly now: () => number;
}
/** Immutable input supplied to every recovery recipe. */
export interface RecoveryInput {
    readonly ctx: Context;
    readonly exec: Readonly<ToolExecution>;
    readonly result: Readonly<ToolExecutionFailure>;
    readonly config: Readonly<ResolvedConfig>;
    readonly services: RecoveryServices;
    /** Aborted by either the tool call or plugin disposal. */
    readonly signal: AbortSignal;
}
/** A controlled match also supplies its normalized class for loop prevention. */
export interface RecoveryMatch {
    readonly fingerprint: string;
}
/** One short, model-facing next action. It never replaces a tool result. */
export interface RecoveryDecision {
    readonly summary: string;
    readonly text: string;
}
/** Stable extension API for built-in and third-party recovery recipes. */
export interface AutoFixRecipe<TMatch extends RecoveryMatch = RecoveryMatch> {
    readonly id: string;
    readonly priority: number;
    match(input: RecoveryInput): TMatch | undefined;
    recover(input: RecoveryInput, match: TMatch): Promise<RecoveryDecision | undefined>;
}
/** Observable in-process receipt; AutoFix does not persist or upload it. */
export interface AutoFixRecoveryEvent {
    readonly version: 1;
    readonly recipeId: string;
    readonly tool: string;
    readonly rootCallId: string;
    readonly nested: boolean;
    readonly fingerprint: string;
    readonly summary: string;
}
//# sourceMappingURL=types.d.ts.map