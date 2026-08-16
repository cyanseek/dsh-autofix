import './events.js'
import type { Context } from '@deepseek-ai/cordis'
import type {
  PostToolDecision,
  PreToolDecision,
  ToolDispatchExecution,
  ToolExecution,
  ToolExecutionResult,
} from '@deepseek-ai/dsh-tools'
import type { Config } from './options.js'
import { resolveConfig } from './options.js'
import { ChaosEngine, type ChaosDecisionEvent, type ChaosExecutionLike } from './core.js'


function executionView(exec: ToolExecution): ChaosExecutionLike {
  return {
    callId: String(exec.callId),
    rootCallId: String(exec.rootCallId),
    name: exec.name,
    arguments: exec.arguments,
  }
}

function chaosFailure(decision: ChaosDecisionEvent, code: string): ToolExecutionResult {
  return {
    isError: true,
    content: [{ type: 'text', text: `Error: ${decision.message}` }],
    error: {
      message: decision.message,
      info: { name: 'ChaosInjectedError', code },
    },
  }
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new Error('tool call aborted during injected delay')
}

async function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw abortReason(signal)
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    const onAbort = (): void => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      reject(abortReason(signal))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function executeInjectedAbort(
  exec: ToolDispatchExecution,
  next: () => Promise<ToolExecutionResult>,
  decision: ChaosDecisionEvent,
  report: () => void,
): Promise<ToolExecutionResult> {
  const upstream = exec.signal
  const controller = new AbortController()
  let chaosFired = false

  const onUpstreamAbort = (): void => controller.abort(abortReason(upstream))
  if (upstream.aborted) onUpstreamAbort()
  else upstream.addEventListener('abort', onUpstreamAbort, { once: true })

  const timer = setTimeout(() => {
    chaosFired = true
    report()
    controller.abort(new Error(decision.message))
  }, decision.delayMs ?? 1_000)

  exec.signal = controller.signal
  try {
    try {
      const result = await next()
      return chaosFired ? chaosFailure(decision, 'CHAOS_ABORTED') : result
    } catch (error: unknown) {
      if (chaosFired) return chaosFailure(decision, 'CHAOS_ABORTED')
      throw error
    }
  } finally {
    clearTimeout(timer)
    upstream.removeEventListener('abort', onUpstreamAbort)
    exec.signal = upstream
  }
}

/** Register deterministic policy, around-dispatch, and post-result faults. */
export function apply(ctx: Context, config: Config = {}): void {
  const engine = new ChaosEngine(resolveConfig(config))
  const report = (decision: ChaosDecisionEvent): void => {
    ctx.emit('tool-chaos/decision', decision)
  }

  ctx.on('tools/pre-execute', async (
    exec: ToolExecution,
    next: () => Promise<PreToolDecision>,
  ): Promise<PreToolDecision> => {
    const decision = engine.decide('pre', executionView(exec))
    if (decision === undefined) return next()
    report(decision)
    if (!decision.injected) return next()
    return { kind: 'deny', reason: decision.message }
  })

  ctx.on('tools/execute', async (
    exec: ToolDispatchExecution,
    next: () => Promise<ToolExecutionResult>,
  ): Promise<ToolExecutionResult> => {
    const decision = engine.decide('execute', executionView(exec))
    if (decision === undefined) return next()
    if (!decision.injected) {
      report(decision)
      return next()
    }

    if (decision.action === 'abort') {
      return executeInjectedAbort(exec, next, decision, () => report(decision))
    }

    report(decision)

    if (decision.action === 'delay') {
      await abortableDelay(decision.delayMs ?? 1_000, exec.signal)
      return next()
    }
    if (decision.action === 'error') {
      return chaosFailure(decision, 'CHAOS_INJECTED')
    }

    // Action/phase mapping is closed in ChaosEngine. This branch protects a
    // future action from silently delegating if the adapter is not updated.
    return chaosFailure(decision, 'CHAOS_ADAPTER_MISMATCH')
  })

  ctx.on('tools/post-execute', async (
    exec: ToolExecution,
    _result: Readonly<ToolExecutionResult>,
    next: () => Promise<PostToolDecision>,
  ): Promise<PostToolDecision> => {
    const decision = engine.decide('post', executionView(exec))
    if (decision === undefined) return next()
    report(decision)
    if (!decision.injected) return next()
    return {
      kind: 'block',
      feedback: [{ type: 'text', text: decision.message }],
    }
  })
}
