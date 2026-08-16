import test from 'node:test'
import assert from 'node:assert/strict'
import { createCommandProbe } from '../lib/engine/command-probe.js'
import {
  DSH_ERROR_ATLAS,
  DSH_ERROR_ATLAS_VERSION,
  commandAlternativeRecipe,
  createDefaultRecipes,
  staleFileRecipe,
  transientRecipe,
} from '../lib/recipes/index.js'

function input({ tool = 'bash', message, code, arguments: args = {}, services = {}, signal } = {}) {
  const controller = new AbortController()
  return {
    ctx: {},
    exec: { callId: 'c', rootCallId: 'r', name: tool, arguments: args, signal: signal ?? controller.signal },
    result: {
      isError: true,
      error: { message, ...(code === undefined ? {} : { info: { name: 'FixtureError', code } }) },
      content: [{ type: 'text', text: message }],
    },
    config: { enabled: true, maxInterventionsPerFingerprint: 1, fingerprintTtlMs: 120000, maxContextChars: 8000, commandCacheTtlMs: 60000, debug: false },
    services: { commandExists: async () => false, platform: process.platform, now: Date.now, ...services },
    signal: signal ?? controller.signal,
  }
}

test('default recipe order is stable and unique', () => {
  const recipes = createDefaultRecipes()
  assert.deepEqual(recipes.map(recipe => recipe.id), [
    'transient-tool-error', 'stale-file-context', 'command-alternative', 'dsh-error-atlas',
  ])
  assert.equal(new Set(recipes.map(recipe => recipe.id)).size, recipes.length)
})

test('transient recipe recognizes the controlled code and HTTP set only', () => {
  for (const code of ['RATE_LIMIT', 'SERVER', 'TIMEOUT', 'TRANSPORT', 'ECONNRESET', 'EAI_AGAIN', 'ETIMEDOUT']) {
    assert.ok(transientRecipe.match(input({ message: 'opaque', code })), code)
  }
  for (const status of [408, 429, 500, 502, 503, 504]) {
    assert.ok(transientRecipe.match(input({ message: `HTTP ${status}` })), status)
  }
  assert.equal(transientRecipe.match(input({ message: 'HTTP 404 not found' })), undefined)
  assert.equal(transientRecipe.match(input({ message: 'retry-after: 999' })), undefined)
  assert.ok(transientRecipe.match(input({ message: 'retry-after: 30' })))
  const metadata = input({ message: 'opaque' })
  metadata.result.meta = { response: { statusCode: 504 } }
  assert.equal(transientRecipe.match(metadata).fingerprint, 'HTTP_504')
})

test('stale recipe extracts nested structured paths and never guesses one from text', () => {
  const matched = staleFileRecipe.match(input({
    tool: 'edit', message: 'replacement target not found',
    arguments: { request: { filePath: 'src/nested.ts', oldText: 'before' } },
  }))
  assert.equal(matched.path, 'src/nested.ts')
  assert.equal(matched.needle, 'before')
  const noPath = staleFileRecipe.match(input({ tool: 'edit', message: 'old text not found in /private/a.ts' }))
  assert.equal(noPath.path, undefined)
})

test('command recipe recommends only a verified candidate and never rewrites arguments', async () => {
  const originalArguments = { command: 'rg TODO src' }
  const checked = []
  const fixture = input({
    message: 'rg: command not found', arguments: originalArguments,
    services: { commandExists: async command => { checked.push(command); return command === 'findstr' } },
  })
  const match = commandAlternativeRecipe.match(fixture)
  const decision = await commandAlternativeRecipe.recover(fixture, match)
  assert.deepEqual(checked, ['grep', 'findstr'])
  assert.match(decision.text, /findstr/)
  assert.deepEqual(fixture.exec.arguments, originalArguments)

  const unavailable = input({ message: 'python: command not found' })
  assert.equal(await commandAlternativeRecipe.recover(unavailable, commandAlternativeRecipe.match(unavailable)), undefined)
  assert.equal(commandAlternativeRecipe.match(input({ tool: 'web_fetch', message: 'rg: command not found' })), undefined)
})

test('command probe honors platform PATH rules, builtins, cache, expiry, and cancellation', async () => {
  let now = 0
  let scans = 0
  const existing = new Set(['/bin/python3', '/opt/homebrew/bin/rg', 'C:/Tools/powershell.exe'])
  const posix = createCommandProbe({
    platform: 'linux', path: '/bin:/usr/bin', ttlMs: 100, now: () => now,
    fileExists: path => { scans += 1; return existing.has(path) },
  })
  const signal = new AbortController().signal
  assert.equal(await posix.exists('python3', signal), true)
  const afterFirst = scans
  assert.equal(await posix.exists('python3', signal), true)
  assert.equal(scans, afterFirst)
  now = 101
  assert.equal(await posix.exists('python3', signal), true)
  assert.ok(scans > afterFirst)

  const windows = createCommandProbe({
    platform: 'win32', path: 'C:/Tools;C:/Windows', pathExt: '.EXE;.CMD', ttlMs: 100,
    fileExists: path => existing.has(path.replaceAll('\\', '/')),
  })
  assert.equal(await windows.exists('Select-String', signal), true)
  assert.equal(await windows.exists('start', signal), false)

  const macos = createCommandProbe({
    platform: 'darwin', path: '/opt/homebrew/bin:/usr/bin', ttlMs: 100,
    fileExists: path => existing.has(path),
  })
  assert.equal(await macos.exists('rg', signal), true)

  const controller = new AbortController()
  controller.abort()
  assert.equal(await posix.exists('python3', controller.signal), false)
})

test('error atlas is versioned, local, and maps every declared signature', async () => {
  assert.equal(DSH_ERROR_ATLAS_VERSION, 1)
  assert.equal(DSH_ERROR_ATLAS.length, 9)
  for (const entry of DSH_ERROR_ATLAS) {
    assert.ok(entry.id.startsWith('DSH_'))
    assert.ok(entry.next.length >= 2)
  }
  const recipe = createDefaultRecipes().at(-1)
  const fixture = input({ tool: 'cordis', message: "Cannot read properties of undefined (reading 'prepare')" })
  const match = recipe.match(fixture)
  const decision = await recipe.recover(fixture, match)
  assert.match(decision.text, /DSH_TOOLS_RUNTIME_DUPLICATE/)
  assert.doesNotMatch(decision.text, /modify session|rewrite profile/i)
})
