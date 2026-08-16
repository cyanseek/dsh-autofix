import { performance } from 'node:perf_hooks'
import { applyRuntime } from '../lib/runtime.js'

let listener
const disposers = []
const ctx = {
  get() { return undefined },
  logger() { return { debug() {} } },
  on(_name, callback) { listener = callback; return () => { listener = undefined } },
  effect(setup) { const dispose = setup(); disposers.push(dispose); return dispose },
}
applyRuntime(ctx)

const exec = {
  callId: 'benchmark', rootCallId: 'benchmark', name: 'noop', arguments: {},
  signal: new AbortController().signal,
}
const result = { isError: false, value: null, content: [] }
const downstream = async () => ({ kind: 'accept' })
const iterations = 100_000

for (let index = 0; index < 1_000; index += 1) await listener(exec, result, downstream)
const started = performance.now()
for (let index = 0; index < iterations; index += 1) await listener(exec, result, downstream)
const elapsedMs = performance.now() - started
for (const dispose of disposers) dispose?.()

process.stdout.write(`${JSON.stringify({
  benchmark: 'success-fast-path',
  node: process.versions.node,
  platform: process.platform,
  iterations,
  elapsedMs,
  operationsPerSecond: iterations / (elapsedMs / 1_000),
}, null, 2)}\n`)
