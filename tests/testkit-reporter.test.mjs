import test from 'node:test'
import assert from 'node:assert/strict'
import process from 'node:process'
import { applyReporter, resolveReporterConfig } from '../lib/testkit/reporter-runtime.js'

function decision(overrides = {}) {
  return {
    plugin: 'dsh-tool-chaos',
    version: 1,
    ruleId: 'first-error',
    action: 'error',
    phase: 'execute',
    tool: 'web_fetch',
    callId: 'call-1',
    rootCallId: 'call-1',
    nested: false,
    matchIndex: 1,
    triggerIndex: 1,
    probability: 1,
    sample: 0.1,
    fingerprint: '12345678',
    dryRun: false,
    injected: true,
    message: 'injected',
    ...overrides,
  }
}

function mount(config = {}) {
  let listener
  const ctx = {
    on(name, callback) {
      assert.equal(name, 'tool-chaos/decision')
      listener = callback
      return () => {}
    },
  }
  applyReporter(ctx, config)
  return value => listener(value)
}

test('reporter emits one stable prefixed JSON line', () => {
  const chunks = []
  const original = process.stderr.write
  process.stderr.write = chunk => {
    chunks.push(String(chunk))
    return true
  }
  try {
    mount()(decision())
  } finally {
    process.stderr.write = original
  }
  assert.equal(chunks.length, 1)
  assert.ok(chunks[0].startsWith('DSH_TOOL_CHAOS_EVENT '))
  const parsed = JSON.parse(chunks[0].slice('DSH_TOOL_CHAOS_EVENT '.length))
  assert.equal(parsed.ruleId, 'first-error')
  assert.equal(parsed.injected, true)
})

test('reporter can omit dry-run decisions', () => {
  const chunks = []
  const original = process.stderr.write
  process.stderr.write = chunk => {
    chunks.push(String(chunk))
    return true
  }
  try {
    const emit = mount({ includeDryRun: false })
    emit(decision({ dryRun: true, injected: false }))
    emit(decision())
  } finally {
    process.stderr.write = original
  }
  assert.equal(chunks.length, 1)
})

test('reporter rejects multiline prefixes', () => {
  assert.throws(() => resolveReporterConfig({ prefix: 'bad\nprefix' }), /prefix/)
})
