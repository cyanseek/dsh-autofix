import type { ToolExecution } from '@deepseek-ai/dsh-tools';
/** Stable identity used for success cleanup without inspecting tool arguments. */
export declare function executionScope(exec: Readonly<ToolExecution>): string;
export declare function recoveryFingerprint(exec: Readonly<ToolExecution>, recipeId: string, normalizedFailure: string): {
    key: string;
    scope: string;
};
//# sourceMappingURL=fingerprint.d.ts.map