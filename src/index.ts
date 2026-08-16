/** Cordis loader metadata. The default plugin only enriches failed tool results. */
export const name = 'dsh-autofix'
export const inject = ['tools']

export { Config, resolveConfig } from './config.js'
export type { ResolvedConfig } from './options.js'
export { apply, applyRecipes } from './runtime.js'
export type { AutoFixRecoveryEvent } from './engine/types.js'
