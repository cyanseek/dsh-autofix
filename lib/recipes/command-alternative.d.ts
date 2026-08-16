import type { AutoFixRecipe, RecoveryMatch } from '../engine/types.js';
interface CommandMatch extends RecoveryMatch {
    readonly command: string;
}
export declare const commandAlternativeRecipe: AutoFixRecipe<CommandMatch>;
export {};
//# sourceMappingURL=command-alternative.d.ts.map