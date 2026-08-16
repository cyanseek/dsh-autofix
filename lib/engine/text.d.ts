import type { ToolExecutionFailure } from '@deepseek-ai/dsh-tools';
/** Obtain bounded failure text without serializing unrelated result fields. */
export declare function failureText(result: Readonly<ToolExecutionFailure>, maximum?: number): string;
/** Deterministic JSON used only on failed calls when forming a fingerprint. */
export declare function stableStringify(value: unknown): string;
export declare function boundText(value: string, maximum: number): string;
//# sourceMappingURL=text.d.ts.map