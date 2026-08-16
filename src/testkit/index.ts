/** Advanced deterministic fault-injection utilities retained for recipe testing. */
export { ChaosEngine, compileGlob, fnv1a32, stableStringify } from './core.js'
export type {
  ChaosDecisionEvent,
  ChaosExecutionLike,
  ChaosPhase,
  ChaosRuleStats,
  ChaosSnapshot,
} from './core.js'
export { resolveConfig as resolveTestConfig } from './options.js'
export type {
  ChaosAction,
  ChaosCallScope,
  ChaosRule,
  Config as TestConfig,
  ResolvedChaosRule,
  ResolvedConfig as ResolvedTestConfig,
} from './options.js'
export { apply as applyTestPlugin } from './runtime.js'
export { applyReporter, resolveReporterConfig } from './reporter-runtime.js'
export type { ReporterConfig } from './reporter-runtime.js'
