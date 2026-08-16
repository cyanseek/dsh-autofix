import type { AutoFixRecipe, RecoveryMatch } from '../engine/types.js';
export interface ErrorAtlasEntry {
    readonly id: string;
    readonly signature: RegExp;
    readonly summary: string;
    readonly next: readonly string[];
}
/** Versioned local catalog. Entries only describe next actions; they mutate no profile or session. */
export declare const DSH_ERROR_ATLAS_VERSION = 1;
export declare const DSH_ERROR_ATLAS: readonly ErrorAtlasEntry[];
interface AtlasMatch extends RecoveryMatch {
    readonly entry: ErrorAtlasEntry;
}
export declare const dshErrorAtlasRecipe: AutoFixRecipe<AtlasMatch>;
export {};
//# sourceMappingURL=dsh-error-atlas.d.ts.map