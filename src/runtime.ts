import process from 'node:process'
import { boundContextSummary, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Context } from '@deepseek-ai/cordis'
import type { PostToolDecision, ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { createCommandProbe } from './engine/command-probe.js'
import { executionScope, recoveryFingerprint } from './engine/fingerprint.js'
import { InterventionState } from './engine/state.js'
import { boundText } from './engine/text.js'
import type {
  AutoFixFileSystem,
  AutoFixRecipe,
  AutoFixRecoveryEvent,
  RecoveryInput,
  RecoveryMatch,
} from './engine/types.js'
import type { Config } from './options.js'
import { resolveConfig } from './options.js'
import { createDefaultRecipes } from './recipes/index.js'

const PLUGIN_SOURCE = { kind: 'plugin' as const, plugin: 'dsh-autofix', form: 'notice' as const }

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  try { return String(error) } catch { return '<unprintable>' }
}

function optionalFileSystem(ctx: Context): AutoFixFileSystem | undefined {
  const candidate = ctx.get('fs') as unknown
  if (candidate === null || typeof candidate !== 'object') return undefined
  const record = candidate as Record<string, unknown>
  if (typeof record.resolve !== 'function' || typeof record.stat !== 'function'
    || typeof record.readText !== 'function' || typeof record.streamText !== 'function') return undefined
  return candidate as AutoFixFileSystem
}

function addContext(downstream: PostToolDecision, context: ReturnType<typeof createUserMessage>): PostToolDecision {
  const additionalContexts = [context, ...downstream.additionalContexts ?? []]
  if (downstream.kind === 'block') return { ...downstream, additionalContexts }
  return { ...downstream, additionalContexts }
}

function emitRecovery(event: AutoFixRecoveryEvent): void {
  try {
    const emit = process.emit as (name: string, payload: unknown) => boolean
    emit.call(process, 'autofix/recovery', event)
  } catch {
    // Optional observers must never change the tool result or recovery path.
  }
}

async function firstMatch(
  recipes: readonly AutoFixRecipe[],
  input: RecoveryInput,
): Promise<{ recipe: AutoFixRecipe; match: RecoveryMatch } | undefined> {
  for (const recipe of recipes) {
    const match = recipe.match(input)
    if (match !== undefined) return { recipe, match }
  }
  return undefined
}

/** Internal/test seam for mounting an explicit ordered recipe list. */
export function applyRuntime(
  ctx: Context,
  config: Config = {},
  recipes: readonly AutoFixRecipe[] = createDefaultRecipes(),
): void {
  const resolved = resolveConfig(config)
  if (!resolved.enabled) return

  const state = new InterventionState(
    resolved.fingerprintTtlMs,
    resolved.maxInterventionsPerFingerprint,
  )
  const commandProbe = createCommandProbe({ ttlMs: resolved.commandCacheTtlMs })
  const lifetime = new AbortController()
  const logger = resolved.debug ? ctx.logger('dsh-autofix') : undefined

  ctx.effect(() => {
    const disposeListener = ctx.on('tools/post-execute', (
      exec: ToolExecution,
      result: Readonly<ToolExecutionResult>,
      next: () => Promise<PostToolDecision>,
    ): Promise<PostToolDecision> => {
      // The successful path delegates before doing any serialization, matching,
      // filesystem/PATH work, logging, event emission, or context construction.
      if (!result.isError) {
        const downstream = next()
        state.clearScope(executionScope(exec))
        return downstream
      }
      if (exec.signal.aborted || lifetime.signal.aborted) return next()

      return (async (): Promise<PostToolDecision> => {
        const signal = AbortSignal.any([exec.signal, lifetime.signal])
        const fs = optionalFileSystem(ctx)
        const input: RecoveryInput = {
          ctx,
          exec,
          result,
          config: resolved,
          services: {
            ...(fs === undefined ? {} : { fs }),
            commandExists: commandProbe.exists,
            platform: process.platform,
            now: Date.now,
          },
          signal,
        }

        let selected: Awaited<ReturnType<typeof firstMatch>>
        try {
          selected = await firstMatch(recipes, input)
        } catch (error: unknown) {
          logger?.debug('recipe matching failed: %s', errorMessage(error))
          return next()
        }
        if (selected === undefined || signal.aborted) return next()

        const fingerprint = recoveryFingerprint(exec, selected.recipe.id, selected.match.fingerprint)
        if (!state.claim(fingerprint.key, fingerprint.scope)) return next()

        let decision
        try {
          decision = await selected.recipe.recover(input, selected.match)
          if (decision === undefined || signal.aborted) {
            state.release(fingerprint.key)
            return next()
          }
        } catch (error: unknown) {
          state.release(fingerprint.key)
          logger?.debug('recipe %s failed: %s', selected.recipe.id, errorMessage(error))
          return next()
        }

        let context
        try {
          const summary = boundContextSummary(decision.summary)
          context = createUserMessage({
            content: [{ type: 'text', text: boundText(decision.text, resolved.maxContextChars) }],
            source: { ...PLUGIN_SOURCE, summary },
          })
        } catch (error: unknown) {
          state.release(fingerprint.key)
          logger?.debug('context construction failed: %s', errorMessage(error))
          return next()
        }

        let downstream
        try {
          downstream = await next()
        } catch (error: unknown) {
          state.release(fingerprint.key)
          throw error
        }
        emitRecovery(Object.freeze({
          version: 1,
          recipeId: selected.recipe.id,
          tool: exec.name,
          rootCallId: String(exec.rootCallId),
          nested: exec.callId !== exec.rootCallId,
          fingerprint: fingerprint.key,
          summary: decision.summary,
        }))
        return addContext(downstream, context)
      })()
    })

    return () => {
      lifetime.abort(new Error('dsh-autofix disposed'))
      state.clear()
      commandProbe.clear()
      disposeListener()
    }
  }, 'dsh-autofix/runtime')
}

/** Register one transparent post-result recovery listener. */
export function apply(ctx: Context, config: Config = {}): void {
  applyRuntime(ctx, config)
}

/** Mount one explicit Recipe set for a custom DSH bundle or plugin integration. */
export function applyRecipes(
  ctx: Context,
  recipes: readonly AutoFixRecipe[],
  config: Config = {},
): void {
  const ids = new Set<string>()
  const ordered = recipes.slice().sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))
  for (const recipe of ordered) {
    if (recipe.id.trim().length === 0) throw new Error('AutoFix Recipe id cannot be empty')
    if (ids.has(recipe.id)) throw new Error(`duplicate AutoFix Recipe id ${JSON.stringify(recipe.id)}`)
    ids.add(recipe.id)
  }
  applyRuntime(ctx, config, ordered)
}
