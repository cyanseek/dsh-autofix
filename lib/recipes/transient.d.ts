import type { AutoFixRecipe, RecoveryMatch } from '../engine/types.js';
interface TransientMatch extends RecoveryMatch {
    readonly className: string;
}
export declare const transientRecipe: AutoFixRecipe<TransientMatch>;
export {};
//# sourceMappingURL=transient.d.ts.map