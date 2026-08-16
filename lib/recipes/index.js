import { commandAlternativeRecipe } from './command-alternative.js';
import { dshErrorAtlasRecipe } from './dsh-error-atlas.js';
import { staleFileRecipe } from './stale-file.js';
import { transientRecipe } from './transient.js';
export { commandAlternativeRecipe } from './command-alternative.js';
export { DSH_ERROR_ATLAS, DSH_ERROR_ATLAS_VERSION, dshErrorAtlasRecipe } from './dsh-error-atlas.js';
export { staleFileRecipe } from './stale-file.js';
export { transientRecipe } from './transient.js';
const BUILT_INS = [
    transientRecipe,
    staleFileRecipe,
    commandAlternativeRecipe,
    dshErrorAtlasRecipe,
].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
export function createDefaultRecipes() {
    return BUILT_INS.slice();
}
//# sourceMappingURL=index.js.map