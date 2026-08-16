/** Lazy-TTL state: no background timer and no resource survives disposal. */
export declare class InterventionState {
    #private;
    constructor(ttlMs: number, maximum: number, now?: () => number);
    claim(key: string, scope: string): boolean;
    release(key: string): void;
    clearScope(scope: string): void;
    clear(): void;
    get size(): number;
}
//# sourceMappingURL=state.d.ts.map