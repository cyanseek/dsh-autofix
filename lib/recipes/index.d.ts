import type { AutoFixRecipe } from '../engine/types.js';
export { commandAlternativeRecipe } from './command-alternative.js';
export { DSH_ERROR_ATLAS, DSH_ERROR_ATLAS_VERSION, dshErrorAtlasRecipe } from './dsh-error-atlas.js';
export type { ErrorAtlasEntry } from './dsh-error-atlas.js';
export { staleFileRecipe } from './stale-file.js';
export { transientRecipe } from './transient.js';
export type { AutoFixFileSystem, AutoFixRecipe, RecoveryDecision, RecoveryInput, RecoveryMatch, RecoveryServices, } from '../engine/types.js';
export declare function createDefaultRecipes(): readonly AutoFixRecipe[];
//# sourceMappingURL=index.d.ts.map