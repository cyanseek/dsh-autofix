import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ChaosEngine,
  compileGlob,
  fnv1a32,
  stableStringify,
} from '../lib/testkit/core.js'
import { resolveConfig } from '../lib/testkit/options.js'

const exec = (overrides = {}) => ({
  callId: 'call-1',
  rootCallId: 'call-1',
  name: 'web_fetch',
  arguments: { url: 'https://example.test', method: 'GET' },
  ...overrides,
})

test('stableStringify sorts object keys recursively', () => {
  const left = stableStringify({ z: 1, a: { y: 2, x: [3, 4] } })
  const right = stableStringify({ a: { x: [3, 4], y: 2 }, z: 1 })
  assert.equal(left, right)
  assert.equal(left, '{"a":{"x":[3,4],"y":2},"z":1}')
})

test('tool glob is anchored and supports star/question mark', () => {
  const pattern = compileGlob('web_?etch*')
  assert.equal(pattern.test('web_fetch'), true)
  assert.equal(pattern.test('web_search'), false)
  assert.equal(pattern.test('prefix-web_fetch'), false)
})

test('same seed and call sequence produce the same sampling fingerprint', () => {
  const config = resolveConfig({
    enabled: true,
    dryRun: false,
    seed: 'repeatable',
    rules: [{
      id: 'flaky-web',
      tool: 'web_*',
      action: 'error',
      probability: 0.5,
      maxInjections: 10,
    }],
  })
  const first = new ChaosEngine(config)
  const second = new ChaosEngine(config)
  const sequenceA = Array.from({ length: 6 }, (_, index) => first.decide('execute', exec({ callId: `c-${index}`, rootCallId: `c-${index}` })))
  const sequenceB = Array.from({ length: 6 }, (_, index) => second.decide('execute', exec({ callId: `different-${index}`, rootCallId: `different-${index}` })))
  assert.deepEqual(
    sequenceA.map(item => item?.fingerprint ?? null),
    sequenceB.map(item => item?.fingerprint ?? null),
  )
})

test('after/every/max schedule is deterministic', () => {
  const engine = new ChaosEngine(resolveConfig({
    enabled: true,
    dryRun: false,
    rules: [{
      id: 'schedule',
      tool: 'web_*',
      action: 'error',
      afterMatches: 1,
      every: 2,
      maxInjections: 2,
    }],
  }))

  const decisions = Array.from({ length: 7 }, (_, index) =>
    engine.decide('execute', exec({ callId: `c-${index}`, rootCallId: `c-${index}` })),
  )
  assert.deepEqual(decisions.map(Boolean), [false, true, false, true, false, false, false])
  assert.deepEqual(engine.snapshot().rules[0], {
    id: 'schedule',
    matched: 7,
    eligible: 2,
    triggered: 2,
    injected: 2,
    dryRuns: 0,
  })
})

test('scope and argument regex narrow rules', () => {
  const engine = new ChaosEngine(resolveConfig({
    enabled: true,
    dryRun: false,
    rules: [{
      id: 'nested-delete',
      tool: 'fs_*',
      action: 'deny',
      scope: 'nested',
      argumentsPattern: 'delete',
      maxInjections: 3,
    }],
  }))

  assert.equal(engine.decide('pre', exec({ name: 'fs_write', arguments: { op: 'delete' } })), undefined)
  assert.equal(engine.decide('pre', exec({ name: 'fs_write', callId: 'root:code:1', rootCallId: 'root', arguments: { op: 'read' } })), undefined)
  assert.equal(engine.decide('pre', exec({ name: 'fs_write', callId: 'root:code:2', rootCallId: 'root', arguments: { op: 'delete' } }))?.ruleId, 'nested-delete')
})

test('dry-run consumes the same trigger budget without injecting', () => {
  const engine = new ChaosEngine(resolveConfig({
    enabled: true,
    dryRun: true,
    rules: [{ id: 'preview', tool: 'web_*', action: 'block', maxInjections: 1 }],
  }))
  const first = engine.decide('post', exec())
  const second = engine.decide('post', exec({ callId: 'call-2', rootCallId: 'call-2' }))
  assert.equal(first?.dryRun, true)
  assert.equal(first?.injected, false)
  assert.equal(second, undefined)
  assert.equal(engine.snapshot().rules[0]?.dryRuns, 1)
})

test('configuration fails closed on unsafe global wildcard and malformed values', () => {
  assert.throws(
    () => resolveConfig({ enabled: true, rules: [{ id: 'all', tool: '*', action: 'error' }] }),
    /allowGlobalWildcard/,
  )
  assert.throws(
    () => resolveConfig({ enabled: true, rules: [{ id: 'bad', tool: 'x', action: 'delay', delayMs: 0 }] }),
    /delayMs/,
  )
  assert.doesNotThrow(() => resolveConfig({
    enabled: true,
    allowGlobalWildcard: true,
    rules: [{ id: 'all', tool: '*', action: 'error' }],
  }))
  assert.throws(() => resolveConfig({ enabled: /** @type {never} */ ('true') }), /enabled must be a boolean/)
  assert.throws(() => resolveConfig({ rules: /** @type {never} */ ({}) }), /rules must be an array/)
  assert.throws(
    () => resolveConfig({ rules: [{ id: 'x', tool: 'a', action: /** @type {never} */ ('unknown') }] }),
    /action is invalid/,
  )
  assert.throws(
    () => resolveConfig({ rules: [{ id: 'x', tool: 'a', action: 'error', scope: /** @type {never} */ ('wide') }] }),
    /scope is invalid/,
  )
})

test('hash function is stable', () => {
  assert.equal(fnv1a32('dsh-tool-chaos'), 3553008132)
})
