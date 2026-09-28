import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { Context } from '@deepseek-ai/cordis'
import { PtcRuntime } from '@deepseek-ai/dsh-ptc-runtime'
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineTool, RUN_CODE_NAME } from '@deepseek-ai/dsh-tools'
import { apply, applyRecipes } from '../lib/index.js'

const require = createRequire(import.meta.url)
const toolsPackage = require('@deepseek-ai/dsh-tools/package.json')
const signal = () => new AbortController().signal

class FakePtcRuntime extends PtcRuntime {
  language = 'typescript'
  isolation = 'fake'
  behavior = async () => ({ logs: [] })

  resolve(request) {
    return request
  }

  run(request) {
    return this.behavior(request)
  }
}

function tool(name, execute) {
  return defineTool({
    name,
    description: `${name} AutoFix fixture`,
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_arguments, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute,
  })
}

async function setup({ beforeApply, afterApply } = {}) {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  beforeApply?.(ctx)
  apply(ctx)
  afterApply?.(ctx)
  return ctx
}

async function execute(ctx, name, arguments_ = {}, overrides = {}) {
  return ctx.tools.execute({
    signal: signal(),
    callId: ToolCallId(overrides.callId ?? 'root-call'),
    ...(overrides.rootCallId === undefined ? {} : { rootCallId: ToolCallId(overrides.rootCallId) }),
    name,
    arguments: arguments_,
  })
}

function recordingAgent() {
  const events = []
  return {
    events,
    agent: {
      session: {
        header: { cwd: '/workspace' },
        append(type, data) { events.push({ type, data }) },
      },
    },
  }
}

function installAutoFix(ctx) {
  const plugin = Object.assign(function AutoFixPlugin(inner) { apply(inner) }, { inject: ['tools'] })
  return ctx.plugin(plugin)
}

test('consumer uses the installed real DSH 0.1.7-rc.2 ToolRuntime', () => {
  assert.equal(toolsPackage.version, '0.1.7-rc.2')
})

test('real DSH consumer completes transient failure then success with zero user input', async () => {
  const ctx = await setup()
  let attempts = 0
  let userInputs = 0
  ctx.tools.register(tool('flaky_fetch', async () => {
    attempts += 1
    if (attempts === 1) throw new Error('HTTP 502 Bad Gateway')
    return { status: 200, body: 'done' }
  }))

  // Deterministic consumer boundary: the real ToolRuntime produces the same
  // additionalContexts the agent loop consumes after a failed tool result.
  let result = await execute(ctx, 'flaky_fetch', { url: 'https://example.test' })
  assert.equal(result.isError, true)
  assert.equal(result.error.message, 'HTTP 502 Bad Gateway')
  assert.equal(result.additionalContexts?.length, 1)
  assert.equal(result.additionalContexts[0].source.kind, 'dsh-autofix')
  if (result.additionalContexts[0].content[0].text.includes('Retry the same operation once now')) {
    result = await execute(ctx, 'flaky_fetch', { url: 'https://example.test' }, { callId: 'retry-call' })
  } else {
    userInputs += 1
  }

  assert.equal(result.isError, false, JSON.stringify(result))
  assert.deepEqual(result.value, { status: 200, body: 'done' })
  assert.equal(attempts, 2)
  assert.equal(userInputs, 0)
})

test('real DSH success and unknown failures stay transparent', async () => {
  const enabled = await setup()
  const baseline = new Context()
  await baseline.plugin(SystemPrompt)
  await baseline.plugin(ToolRuntime)
  const body = async () => ({ answer: 42 })
  enabled.tools.register(tool('stable', body))
  baseline.tools.register(tool('stable', body))
  assert.deepEqual(await execute(enabled, 'stable'), await execute(baseline, 'stable'))

  enabled.tools.register(tool('permanent', async () => { throw new Error('domain invariant failed') }))
  baseline.tools.register(tool('permanent', async () => { throw new Error('domain invariant failed') }))
  assert.deepEqual(await execute(enabled, 'permanent'), await execute(baseline, 'permanent'))
})

test('three real DSH plugin layers run once, preserve FIFO contexts, and emit one final result', async () => {
  const order = []
  let outerExecute = 0
  let innerExecute = 0
  let postContext = 0
  let resultEvents = 0

  const ctx = await setup({
    beforeApply(runtime) {
      runtime.on('tools/execute', async (_exec, next) => {
        outerExecute += 1
        order.push('outer-enter')
        const result = await next()
        order.push('outer-exit')
        return result
      })
    },
    afterApply(runtime) {
      runtime.on('tools/execute', async (_exec, next) => {
        innerExecute += 1
        order.push('inner-enter')
        const result = await next()
        order.push('inner-exit')
        return result
      })
      runtime.on('tools/post-execute', async (_exec, _result, next) => {
        postContext += 1
        const downstream = await next()
        const context = createUserMessage({
          content: [{ type: 'text', text: 'downstream context' }],
          source: { kind: 'dummy-context', form: 'notice', summary: 'Test context' },
        })
        return { ...downstream, additionalContexts: [context, ...downstream.additionalContexts ?? []] }
      })
      runtime.on('tools/result', () => { resultEvents += 1 })
    },
  })
  ctx.tools.register(tool('composed', async () => { throw new Error('HTTP 503 Service Unavailable') }))
  const result = await execute(ctx, 'composed', { page: 1 })

  assert.equal(result.isError, true)
  assert.equal(outerExecute, 1)
  assert.equal(innerExecute, 1)
  assert.equal(postContext, 1)
  assert.equal(resultEvents, 1)
  assert.deepEqual(order, ['outer-enter', 'inner-enter', 'inner-exit', 'outer-exit'])
  assert.deepEqual(result.additionalContexts.map(item => item.source.kind), ['dsh-autofix', 'dummy-context'])
})

test('nested calls receive separate fingerprints without writing recovery text into tool content', async () => {
  const ctx = await setup()
  ctx.tools.register(tool('nested_fetch', async () => { throw new Error('ETIMEDOUT while connecting') }))

  const first = await execute(ctx, 'nested_fetch', { url: 'a' }, { callId: 'root:code:1', rootCallId: 'root' })
  const duplicate = await execute(ctx, 'nested_fetch', { url: 'a' }, { callId: 'root:code:2', rootCallId: 'root' })
  const different = await execute(ctx, 'nested_fetch', { url: 'b' }, { callId: 'root:code:3', rootCallId: 'root' })

  assert.equal(first.additionalContexts?.length, 1)
  assert.equal(duplicate.additionalContexts, undefined)
  assert.equal(different.additionalContexts?.length, 1)
  for (const result of [first, duplicate, different]) {
    assert.equal(result.content.some(block => block.type === 'text' && block.text.includes('AutoFix')), false)
    assert.equal(result.error.message, 'ETIMEDOUT while connecting')
  }
})

test('real PTC registry with a synthetic provider preserves dispatch adjacency and keeps recovery text out of program results', async () => {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime, { mode: 'ptc' })
  await ctx.plugin(FakePtcRuntime)
  apply(ctx)

  let attempts = 0
  for (const name of ['flaky_alpha', 'flaky_beta']) {
    ctx.tools.register(tool(name, async () => {
      attempts += 1
      throw new Error('HTTP 503 Service Unavailable')
    }))
  }
  ctx.ptcRuntime.behavior = async (request) => {
    const functions = request.bindings[0].functions
    await functions.flaky_alpha({ key: 'same' }).catch(() => undefined)
    await functions.flaky_alpha({ key: 'same' }).catch(() => undefined)
    await functions.flaky_beta({ key: 'other' }).catch(() => undefined)
    return { logs: [], value: 'program-done' }
  }

  const { agent, events } = recordingAgent()
  const result = await ctx.tools.execute({
    signal: signal(),
    callId: ToolCallId('code-root'),
    name: RUN_CODE_NAME,
    arguments: { code: 'program', description: 'Exercise nested AutoFix calls' },
    agent,
  })

  assert.equal(result.isError, false, JSON.stringify(result))
  assert.equal(attempts, 3)
  assert.equal(result.additionalContexts?.length, 2)
  assert.deepEqual(result.additionalContexts.map(item => item.source.kind), ['dsh-autofix', 'dsh-autofix'])
  assert.equal(JSON.stringify(result.content).includes('AutoFix'), false)
  assert.deepEqual(events.map(event => event.type), [
    'tool/ptc-dispatch-start', 'tool/ptc-dispatch',
    'tool/ptc-dispatch-start', 'tool/ptc-dispatch',
    'tool/ptc-dispatch-start', 'tool/ptc-dispatch',
  ])
  assert.equal(events.some(event => JSON.stringify(event).includes('AutoFix')), false)
  assert.deepEqual(
    events.filter(event => event.type === 'tool/ptc-dispatch').map(event => event.data.name),
    ['flaky_alpha', 'flaky_alpha', 'flaky_beta'],
  )
})

test('disposing and remounting AutoFix leaves one listener and preserves dummy plugin behavior', async () => {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  let wrapperCalls = 0
  let dummyContexts = 0
  ctx.on('tools/execute', async (_exec, next) => {
    wrapperCalls += 1
    return next()
  })
  ctx.on('tools/post-execute', async (_exec, _result, next) => {
    dummyContexts += 1
    const downstream = await next()
    return {
      ...downstream,
      additionalContexts: [createUserMessage({
        content: [{ type: 'text', text: 'dummy context' }],
        source: { kind: 'dummy-context', form: 'notice', summary: 'Test context' },
      }), ...downstream.additionalContexts ?? []],
    }
  })
  ctx.tools.register(tool('lifecycle_fetch', async () => { throw new Error('HTTP 502 Bad Gateway') }))

  const firstFiber = await installAutoFix(ctx)
  const beforeDispose = await execute(ctx, 'lifecycle_fetch', { request: 1 })
  assert.deepEqual(beforeDispose.additionalContexts.map(item => item.source.kind), ['dummy-context', 'dsh-autofix'])

  await firstFiber.dispose()
  const disposed = await execute(ctx, 'lifecycle_fetch', { request: 2 })
  assert.deepEqual(disposed.additionalContexts.map(item => item.source.kind), ['dummy-context'])

  const secondFiber = await installAutoFix(ctx)
  const remounted = await execute(ctx, 'lifecycle_fetch', { request: 3 })
  assert.deepEqual(remounted.additionalContexts.map(item => item.source.kind), ['dummy-context', 'dsh-autofix'])
  assert.equal(remounted.additionalContexts.filter(item => item.source.kind === 'dsh-autofix').length, 1)
  assert.equal(wrapperCalls, 3)
  assert.equal(dummyContexts, 3)
  await secondFiber.dispose()
})

test('public applyRecipes mounts one ordered custom recovery set', async () => {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  const calls = []
  const lower = {
    id: 'custom-lower', priority: 10,
    match() { calls.push('lower'); return { fingerprint: 'lower' } },
    async recover() { return { summary: 'lower', text: 'lower recipe' } },
  }
  const higher = {
    id: 'custom-higher', priority: 20,
    match() { calls.push('higher'); return { fingerprint: 'higher' } },
    async recover() { return { summary: 'higher', text: 'custom recovery applied' } },
  }
  applyRecipes(ctx, [lower, higher])
  ctx.tools.register(tool('custom_failure', async () => { throw new Error('custom failure') }))

  const result = await execute(ctx, 'custom_failure')
  assert.deepEqual(calls, ['higher'])
  assert.equal(result.additionalContexts?.length, 1)
  assert.match(result.additionalContexts[0].content[0].text, /custom recovery applied/)
  assert.throws(() => applyRecipes(ctx, [higher, higher]), /duplicate AutoFix Recipe id/)
})

test('approval denial is never turned into an automatic recovery request', async () => {
  const ctx = await setup()
  let dispatched = false
  ctx.on('tools/pre-execute', async () => ({ kind: 'deny', reason: 'Do not retry the HTTP 502 operation without approval' }))
  ctx.tools.register(tool('denied_fetch', async () => { dispatched = true; return {} }))
  const result = await execute(ctx, 'denied_fetch')
  assert.equal(result.isError, true)
  assert.equal(dispatched, false)
  assert.equal(result.additionalContexts, undefined, JSON.stringify(result))
})

test('a downstream policy block discards recovery advice', async () => {
  const ctx = await setup({ afterApply(runtime) {
    runtime.on('tools/post-execute', async () => ({ kind: 'block', feedback: [{ type: 'text', text: 'Policy withheld result' }] }))
  } })
  ctx.tools.register(tool('blocked_fetch', async () => { throw new Error('HTTP 502') }))
  const result = await execute(ctx, 'blocked_fetch')
  assert.equal(result.isError, true)
  assert.equal(result.additionalContexts, undefined)
})
