import test from 'node:test'
import assert from 'node:assert/strict'
import { applyRuntime } from '../lib/runtime.js'

function execution(overrides = {}) {
  return {
    callId: 'call-1',
    rootCallId: 'call-1',
    name: 'web_fetch',
    arguments: { url: 'https://example.test' },
    signal: new AbortController().signal,
    ...overrides,
  }
}

function failure(message, overrides = {}) {
  return {
    isError: true,
    error: { message },
    content: [{ type: 'text', text: message }],
    ...overrides,
  }
}

function mount({ fs, recipes, config } = {}) {
  let listener
  const disposers = []
  const debug = []
  const ctx = {
    get(name) { return name === 'fs' ? fs : undefined },
    logger() { return { debug: (...args) => debug.push(args) } },
    on(name, callback) {
      assert.equal(name, 'tools/post-execute')
      listener = callback
      return () => { listener = undefined }
    },
    effect(setup) {
      const dispose = setup()
      disposers.push(dispose)
      return dispose
    },
  }
  applyRuntime(ctx, config, recipes)
  return {
    invoke: (exec, result, downstream = { kind: 'accept' }) => {
      if (listener === undefined) throw new Error('listener is not mounted')
      let calls = 0
      const decision = listener(exec, result, async () => { calls += 1; return downstream })
      return { decision, calls: () => calls }
    },
    dispose: () => { for (const dispose of disposers) dispose?.() },
    hasListener: () => listener !== undefined,
    debug,
  }
}

function contextText(decision) {
  return decision.additionalContexts?.[0]?.content?.[0]?.text
}

test('successful results take the transparent fast path', async () => {
  const mounted = mount()
  const argumentsProxy = new Proxy({}, { ownKeys() { throw new Error('arguments were serialized') } })
  const downstream = { kind: 'accept', additionalContexts: [{ marker: 'downstream' }] }
  const success = { isError: false, value: { ok: true }, content: [], meta: { a: 1 }, concludesTurn: true }
  const call = mounted.invoke(execution({ arguments: argumentsProxy }), success, downstream)
  assert.equal(await call.decision, downstream)
  assert.equal(call.calls(), 1)
})

test('unknown failures and recipe exceptions preserve the downstream decision', async () => {
  const downstream = { kind: 'block', feedback: [{ type: 'text', text: 'owned downstream' }] }
  const unknown = mount()
  assert.equal(await unknown.invoke(execution(), failure('permanent application error'), downstream).decision, downstream)

  const throwing = {
    id: 'throwing', priority: 999,
    match() { throw new Error('recipe bug') },
    async recover() { throw new Error('unreachable') },
  }
  const broken = mount({ recipes: [throwing], config: { debug: true } })
  assert.equal(await broken.invoke(execution(), failure('HTTP 502'), downstream).decision, downstream)
  assert.equal(broken.debug.length, 1)
})

test('transient recovery is deduplicated, independent by fingerprint, and reset by success', async () => {
  const mounted = mount()
  const first = await mounted.invoke(execution(), failure('HTTP 502 Bad Gateway')).decision
  assert.match(contextText(first), /Retry the same operation once now/)
  assert.equal(first.additionalContexts.length, 1)

  const duplicate = await mounted.invoke(execution(), failure('HTTP 502 Bad Gateway')).decision
  assert.deepEqual(duplicate, { kind: 'accept' })

  const different = await mounted.invoke(execution({ arguments: { url: 'https://other.test' } }), failure('HTTP 502 Bad Gateway')).decision
  assert.equal(different.additionalContexts.length, 1)

  await mounted.invoke(execution(), { isError: false, value: 'ok', content: [] }).decision
  const afterSuccess = await mounted.invoke(execution(), failure('HTTP 502 Bad Gateway')).decision
  assert.equal(afterSuccess.additionalContexts.length, 1)
})

test('structured transient codes outrank text and preserve downstream FIFO', async () => {
  const mounted = mount()
  const downstreamContext = { id: 'downstream-context' }
  const result = failure('unrelated text', { error: { message: 'unrelated text', info: { name: 'FetchError', code: 'RATE_LIMIT' } } })
  const decision = await mounted.invoke(execution(), result, {
    kind: 'accept',
    additionalContexts: [downstreamContext],
  }).decision
  assert.match(contextText(decision), /RATE_LIMIT/)
  assert.equal(decision.additionalContexts[1], downstreamContext)
})

test('an already-aborted call receives no recovery context', async () => {
  const controller = new AbortController()
  controller.abort(new Error('cancelled'))
  const mounted = mount()
  const downstream = { kind: 'accept' }
  assert.equal(await mounted.invoke(execution({ signal: controller.signal }), failure('HTTP 503'), downstream).decision, downstream)
})

test('stale file recovery uses bounded DSH fs context and fallback when unavailable', async () => {
  const signals = []
  const lines = Array.from({ length: 200 }, (_, index) => `line-${index}`).join('\n')
  const fs = {
    async resolve(path, options) { signals.push(options.signal); return path },
    async stat(_target, signal) { signals.push(signal); return { type: 'file', size: 100_000 } },
    async readText() { throw new Error('large files must stream') },
    async streamText(_target, signal) {
      signals.push(signal)
      return (async function* () { yield lines })()
    },
  }
  const mounted = mount({ fs })
  const exec = execution({ name: 'edit', arguments: { path: 'src/app.ts', oldString: 'line-100' } })
  const decision = await mounted.invoke(exec, failure('old text not found')).decision
  const text = contextText(decision)
  assert.match(text, /Current excerpt from src\/app\.ts/)
  assert.match(text, /line-100/)
  assert.ok(text.split('\n').length < 100)
  assert.ok(signals.every(signal => signal instanceof AbortSignal))

  const fallback = mount()
  const fallbackDecision = await fallback.invoke(exec, failure('file changed since last read')).decision
  assert.match(contextText(fallbackDecision), /Re-read the target file/)
})

test('plugin disposal removes the listener and aborts an in-flight read', async () => {
  let observedSignal
  const fs = {
    resolve(_path, options) {
      observedSignal = options.signal
      return new Promise(resolve => options.signal.addEventListener('abort', () => resolve('target'), { once: true }))
    },
    async stat() { return { type: 'file', size: 1 } },
    async readText() { return 'x' },
    async streamText() { return (async function* () { yield 'x' })() },
  }
  const mounted = mount({ fs })
  const pending = mounted.invoke(execution({ name: 'edit', arguments: { path: 'a.ts' } }), failure('stale file')).decision
  await new Promise(resolve => setImmediate(resolve))
  mounted.dispose()
  assert.equal(observedSignal.aborted, true)
  assert.equal(mounted.hasListener(), false)
  assert.deepEqual(await pending, { kind: 'accept' })
})

test('disabled runtime registers no listener', () => {
  const mounted = mount({ config: { enabled: false } })
  assert.equal(mounted.hasListener(), false)
})
