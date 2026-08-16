import type { Context } from '@deepseek-ai/cordis';
import type { AutoFixRecipe } from './engine/types.js';
import type { Config } from './options.js';
/** Internal/test seam for mounting an explicit ordered recipe list. */
export declare function applyRuntime(ctx: Context, config?: Config, recipes?: readonly AutoFixRecipe[]): void;
/** Register one transparent post-result recovery listener. */
export declare function apply(ctx: Context, config?: Config): void;
/** Mount one explicit Recipe set for a custom DSH bundle or plugin integration. */
export declare function applyRecipes(ctx: Context, recipes: readonly AutoFixRecipe[], config?: Config): void;
//# sourceMappingURL=runtime.d.ts.map