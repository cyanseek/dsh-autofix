import type { AutoFixRecipe, RecoveryMatch } from '../engine/types.js';
interface StaleMatch extends RecoveryMatch {
    readonly path?: string;
    readonly needle?: string;
}
export declare const staleFileRecipe: AutoFixRecipe<StaleMatch>;
export {};
//# sourceMappingURL=stale-file.d.ts.map