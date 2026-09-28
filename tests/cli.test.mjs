import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const cli = resolve('bin/dsh-autofix.mjs')

function run(args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
}

function fixture(profiles = ['web', 'headless']) {
  const version = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version
  const root = mkdtempSync(join(tmpdir(), 'dsh-autofix-cli-'))
  const dshHome = join(root, 'dsh-home')
  const agentsHome = join(root, 'agents-home')
  const log = join(root, 'dsh-calls.jsonl')
  for (const profile of profiles) mkdirSync(join(dshHome, 'profiles', profile), { recursive: true })
  mkdirSync(agentsHome, { recursive: true })
  const fakeDsh = join(root, 'fake-dsh.mjs')
  writeFileSync(fakeDsh, `#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
const args = process.argv.slice(2)
const log = process.env.DSH_AUTOFIX_FAKE_LOG
if (log) { mkdirSync(dirname(log), { recursive: true }); appendFileSync(log, JSON.stringify(args) + '\\n') }
if (args.includes('--help')) process.exit(0)
const profileIndex = args.indexOf('--profile')
const profile = profileIndex >= 0 ? args[profileIndex + 1] : undefined
const marker = profile ? join(process.env.DSH_HOME, 'profiles', profile, '.autofix-installed') : undefined
if (args[0] === 'plugin') {
  const action = args[3]
  if (action === 'add') {
    writeFileSync(marker, args[4], 'utf8')
    const manifest = join(process.env.DSH_HOME, 'profiles', profile, 'node_modules', 'dsh-autofix', 'package.json')
    mkdirSync(dirname(manifest), { recursive: true })
    writeFileSync(manifest, JSON.stringify({ version: '${version}' }))
  }
  else if (action === 'remove') rmSync(marker, { force: true })
  process.exit(0)
}
if (args.includes('--dump-config')) {
  console.log(marker && existsSync(marker) ? '- id: autofix\\n  name: dsh-autofix' : '- id: tools')
  process.exit(0)
}
process.exit(0)
`, 'utf8')
  chmodSync(fakeDsh, 0o755)
  return {
    root, dshHome, agentsHome, log, fakeDsh,
    env: {
      DSH_HOME: dshHome,
      DSH_AGENTS_HOME: agentsHome,
      DSH_AUTOFIX_DSH_BIN: fakeDsh,
      DSH_AUTOFIX_FAKE_LOG: log,
      DSH_AUTOFIX_SOURCE: resolve('dsh-autofix-0.1.0.tgz'),
    },
  }
}

function calls(fixture_) {
  if (!existsSync(fixture_.log)) return []
  return readFileSync(fixture_.log, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
}

test('help exposes only the four supported public commands', () => {
  const result = run(['help'])
  assert.equal(result.status, 0)
  for (const command of ['install', 'uninstall', 'verify', 'test']) assert.match(result.stdout, new RegExp(`dsh-autofix ${command}`))
  for (const removed of ['doctor', 'setup', 'init', 'install-skill', 'codex', 'prompt']) assert.doesNotMatch(result.stdout, new RegExp(`dsh-autofix ${removed}`))
})

test('install discovers both profiles, installs the Skill, verifies, and is idempotent', () => {
  const f = fixture()
  const activeTask = join(f.root, 'active-task')
  writeFileSync(activeTask, 'running', 'utf8')

  const first = run(['install', '--json'], f.env)
  assert.equal(first.status, 0, first.stderr)
  const report = JSON.parse(first.stdout)
  assert.deepEqual(report.profiles.map(item => item.profile), ['web', 'headless'])
  assert.equal(report.profiles.every(item => item.verified && item.changed), true)
  assert.equal(report.packageLoad, true)
  assert.equal(report.safeToRetry, true)
  assert.equal(existsSync(join(f.dshHome, 'skills', 'dsh-autofix', 'SKILL.md')), true)
  assert.equal(existsSync(join(f.agentsHome, 'skills', 'dsh-autofix', 'SKILL.md')), true)
  assert.equal(readFileSync(activeTask, 'utf8'), 'running')

  const second = run(['install', '--json'], f.env)
  assert.equal(second.status, 0, second.stderr)
  assert.equal(JSON.parse(second.stdout).changed, false)
  const addCalls = calls(f).filter(args => args[0] === 'plugin' && args[3] === 'add')
  assert.equal(addCalls.length, 2)
})

test('human install output stays short and requires no activation step', () => {
  const f = fixture(['web'])
  const result = run(['install'], f.env)
  assert.equal(result.status, 0, result.stderr)
  assert.ok(result.stdout.trim().split(/\r?\n/).length <= 10)
  assert.doesNotMatch(result.stdout, /restart|dump-config|allowBuilds|choose|confirm/i)
  assert.match(result.stdout, /Use DSH normally/)
})

test('uninstall removes profile activation and both Skill copies cleanly', () => {
  const f = fixture()
  assert.equal(run(['install', '--json'], f.env).status, 0)
  const result = run(['uninstall', '--json'], f.env)
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.profiles.every(item => !item.installed && item.changed), true)
  assert.equal(existsSync(join(f.dshHome, 'skills', 'dsh-autofix')), false)
  assert.equal(existsSync(join(f.agentsHome, 'skills', 'dsh-autofix')), false)
  assert.equal(calls(f).filter(args => args[0] === 'plugin' && args[3] === 'remove').length, 2)
})

test('installer changes only existing built-in profiles under a custom DSH_HOME', () => {
  const f = fixture(['headless'])
  mkdirSync(join(f.dshHome, 'profiles', 'custom'), { recursive: true })
  const result = run(['install', '--json'], f.env)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout).profiles.map(item => item.profile), ['headless'])
  assert.equal(calls(f).some(args => args.includes('custom')), false)
})

test('tarball, npm, and prebuilt artifact sources pass unchanged to DSH', () => {
  for (const source of ['./dsh-autofix.tgz', 'dsh-autofix@0.1.0', 'https://example.test/dsh-autofix.tgz']) {
    const f = fixture(['web'])
    const result = run(['install', '--json'], { ...f.env, DSH_AUTOFIX_SOURCE: source })
    assert.equal(result.status, 0, `${source}: ${result.stderr}`)
    const add = calls(f).find(args => args[0] === 'plugin' && args[3] === 'add')
    assert.equal(add[4], source)
  }
})

test('missing profiles fail without creating one or installing the Skill', () => {
  const f = fixture([])
  const result = run(['install'], f.env)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /no existing web or headless profile/)
  assert.match(result.stderr, /Automatic action:/)
  assert.match(result.stderr, /Profile changes: none/)
  assert.match(result.stderr, /Safe to retry: yes/)
  assert.equal(existsSync(join(f.dshHome, 'skills', 'dsh-autofix')), false)
})

test('verify separates publish readiness from profile installation state', () => {
  const f = fixture(['web'])
  const before = run(['verify', '--json'], f.env)
  assert.equal(before.status, 0, before.stderr)
  const report = JSON.parse(before.stdout)
  assert.equal(report.publishReady, true)
  assert.equal(report.dsh.profiles[0].installed, false)
  assert.equal(report.artifacts.testkit, true)
})

test('all bundled deterministic scenarios execute from the prebuilt package', () => {
  for (const scenario of ['transient-tool-error', 'stale-file', 'command-alternative', 'error-atlas']) {
    const result = run(['test', '--scenario', scenario, '--json'])
    assert.equal(result.status, 0, `${scenario}: ${result.stderr}`)
    const report = JSON.parse(result.stdout)
    assert.equal(report.passed, true)
    assert.equal(report.scenario, scenario)
  }
})

test('install upgrades an older active artifact and defaults to the running package', () => {
  const f = fixture(['web'])
  const env = { ...f.env, DSH_AUTOFIX_SOURCE: '' }
  assert.equal(run(['install', '--json'], env).status, 0)
  const manifest = join(f.dshHome, 'profiles', 'web', 'node_modules', 'dsh-autofix', 'package.json')
  writeFileSync(manifest, JSON.stringify({ version: '0.1.0' }))
  const update = run(['install', '--json'], env)
  assert.equal(update.status, 0, update.stderr)
  const report = JSON.parse(update.stdout)
  assert.equal(report.changed, true)
  assert.equal(report.source, `file:${resolve('.')}`)
  assert.equal(calls(f).filter(args => args[0] === 'plugin' && args[3] === 'add').length, 2)
})
