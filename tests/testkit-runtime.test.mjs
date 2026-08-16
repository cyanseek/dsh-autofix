import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/testkit/runtime.js'

function mount(config) {
  const listeners = new Map()
  const events = []
  const ctx = {
    on(name, listener) {
      listeners.set(name, listener)
      return () => listeners.delete(name)
    },
    emit(name, payload) {
      events.push({ name, payload })
    },
  }
  apply(ctx, config)
  return { listeners, events }
}

function execution(overrides = {}) {
  return {
    callId: 'call-1',
    rootCallId: 'call-1',
    name: 'bash',
    arguments: { command: 'echo ok' },
    signal: new AbortController().signal,
    ...overrides,
  }
}

test('pre-execute deny stops dispatch and emits a decision', async () => {
  const { listeners, events } = mount({
    enabled: true,
    dryRun: false,
    rules: [{ id: 'deny-bash', tool: 'bash', action: 'deny' }],
  })
  const listener = listeners.get('tools/pre-execute')
  const decision = await listener(execution(), async () => ({ kind: 'allow' }))
  assert.deepEqual(decision, {
    kind: 'deny',
    reason: 'chaos rule "deny-bash" injected deny for tool "bash"',
  })
  assert.equal(events.length, 1)
  assert.equal(events[0].name, 'tool-chaos/decision')
  assert.equal(events[0].payload.injected, true)
})

test('dry-run reports an exact would-inject decision but delegates', async () => {
  const { listeners, events } = mount({
    enabled: true,
    dryRun: true,
    rules: [{ id: 'preview', tool: 'bash', action: 'deny' }],
  })
  const listener = listeners.get('tools/pre-execute')
  const downstream = { kind: 'allow' }
  assert.equal(await listener(execution(), async () => downstream), downstream)
  assert.equal(events[0].payload.dryRun, true)
  assert.equal(events[0].payload.injected, false)
})

test('around error returns a structured routable failure without calling the tool', async () => {
  const { listeners } = mount({
    enabled: true,
    dryRun: false,
    rules: [{ id: 'flaky-bash', tool: 'bash', action: 'error' }],
  })
  let called = false
  const result = await listeners.get('tools/execute')(execution(), async () => {
    called = true
    return { isError: false, value: 'ok', content: [{ type: 'text', text: 'ok' }] }
  })
  assert.equal(called, false)
  assert.equal(result.isError, true)
  assert.equal(result.error.info.code, 'CHAOS_INJECTED')
})

test('delay is applied before dispatch', async () => {
  const { listeners } = mount({
    enabled: true,
    dryRun: false,
    rules: [{ id: 'slow-bash', tool: 'bash', action: 'delay', delayMs: 20 }],
  })
  const started = performance.now()
  const result = await listeners.get('tools/execute')(execution(), async () => ({
    isError: false,
    value: 'ok',
    content: [{ type: 'text', text: 'ok' }],
  }))
  assert.equal(result.isError, false)
  assert.ok(performance.now() - started >= 15)
})

test('injected abort reaches the delegated signal and restores the upstream signal', async () => {
  const { listeners, events } = mount({
    enabled: true,
    dryRun: false,
    rules: [{ id: 'abort-bash', tool: 'bash', action: 'abort', delayMs: 10 }],
  })
  const exec = execution()
  const upstream = exec.signal
  let delegatedSignal
  const result = await listeners.get('tools/execute')(exec, async () => {
    delegatedSignal = exec.signal
    await new Promise((resolve, reject) => {
      if (exec.signal.aborted) reject(exec.signal.reason)
      else exec.signal.addEventListener('abort', () => reject(exec.signal.reason), { once: true })
    })
    return { isError: false, value: 'unreachable', content: [] }
  })
  assert.notEqual(delegatedSignal, upstream)
  assert.equal(delegatedSignal.aborted, true)
  assert.equal(exec.signal, upstream)
  assert.equal(result.isError, true)
  assert.equal(result.error.info.code, 'CHAOS_ABORTED')
  assert.equal(events.length, 1)
  assert.equal(events[0].payload.action, 'abort')
})

test('abort does not report an injection when delegated work finishes before its deadline', async () => {
  const { listeners, events } = mount({
    enabled: true,
    dryRun: false,
    rules: [{ id: 'late-abort', tool: 'bash', action: 'abort', delayMs: 100 }],
  })
  const exec = execution()
  const upstream = exec.signal
  const result = await listeners.get('tools/execute')(exec, async () => ({
    isError: false,
    value: 'already-finished',
    content: [{ type: 'text', text: 'already-finished' }],
  }))
  assert.equal(result.isError, false)
  assert.equal(exec.signal, upstream)
  assert.equal(events.length, 0)
})

test('post-execute block withholds a successful result', async () => {
  const { listeners } = mount({
    enabled: true,
    dryRun: false,
    rules: [{ id: 'block-bash', tool: 'bash', action: 'block', message: 'simulated validation rejection' }],
  })
  const decision = await listeners.get('tools/post-execute')(
    execution(),
    { isError: false, value: 'ok', content: [{ type: 'text', text: 'ok' }] },
    async () => ({ kind: 'accept' }),
  )
  assert.deepEqual(decision, {
    kind: 'block',
    feedback: [{ type: 'text', text: 'simulated validation rejection' }],
  })
})

test('disabled plugin registers inert delegates', async () => {
  const { listeners, events } = mount({ enabled: false, rules: [{ id: 'x', tool: 'bash', action: 'deny' }] })
  assert.deepEqual(
    await listeners.get('tools/pre-execute')(execution(), async () => ({ kind: 'allow' })),
    { kind: 'allow' },
  )
  assert.equal(events.length, 0)
})
