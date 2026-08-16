#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))

function takeFlag(args, flag) {
  const index = args.indexOf(flag)
  if (index < 0) return false
  args.splice(index, 1)
  return true
}

function option(args, name) {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  const value = args[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`)
  args.splice(index, 2)
  return value
}

function help() {
  process.stdout.write(`dsh-autofix ${manifest.version}\n\n`)
  process.stdout.write('Fix common DSH failures automatically and keep the task moving.\n\n')
  process.stdout.write('Usage:\n')
  process.stdout.write('  dsh-autofix install [--json]\n')
  process.stdout.write('  dsh-autofix uninstall [--json]\n')
  process.stdout.write('  dsh-autofix verify [--json]\n')
  process.stdout.write('  dsh-autofix test --scenario <name> [--json]\n')
}

async function runScenario(name) {
  const { createDefaultRecipes } = await import('../lib/recipes/index.js')
  const fixtures = {
    'transient-tool-error': { tool: 'web_fetch', message: 'HTTP 502 Bad Gateway', arguments: { url: 'https://example.test' } },
    'stale-file': { tool: 'edit', message: 'old text not found', arguments: { path: 'fixture.txt', oldString: 'before' } },
    'command-alternative': { tool: 'bash', message: 'rg: command not found', arguments: { command: 'rg fixture' } },
    'error-atlas': { tool: 'cordis', message: "Cannot read properties of undefined (reading 'prepare')", arguments: {} },
  }
  const fixture = fixtures[name]
  if (fixture === undefined) throw new Error(`unknown scenario ${JSON.stringify(name)}`)
  const controller = new AbortController()
  const input = {
    ctx: {},
    exec: { callId: 'test', rootCallId: 'test', name: fixture.tool, arguments: fixture.arguments, signal: controller.signal },
    result: { isError: true, error: { message: fixture.message }, content: [{ type: 'text', text: fixture.message }] },
    config: { enabled: true, maxInterventionsPerFingerprint: 1, fingerprintTtlMs: 120000, maxContextChars: 8000, commandCacheTtlMs: 60000, debug: false },
    services: {
      commandExists: async command => command === 'grep',
      platform: process.platform,
      now: Date.now,
      ...(name === 'stale-file' ? { fs: {
        resolve: async path => path,
        stat: async () => ({ type: 'file', size: 12 }),
        readText: async () => 'current text',
        streamText: async () => (async function* () { yield 'current text' })(),
      } } : {}),
    },
    signal: controller.signal,
  }
  for (const recipe of createDefaultRecipes()) {
    const match = recipe.match(input)
    if (match === undefined) continue
    const decision = await recipe.recover(input, match)
    return { scenario: name, passed: decision !== undefined, recipeId: recipe.id, summary: decision?.summary }
  }
  return { scenario: name, passed: false }
}

async function main() {
  const args = process.argv.slice(2)
  const command = args.shift() ?? 'help'
  if (['help', '--help', '-h'].includes(command)) return help()
  if (['version', '--version', '-v'].includes(command)) return process.stdout.write(`${manifest.version}\n`)
  const json = takeFlag(args, '--json')

  if (command === 'test') {
    const scenario = option(args, '--scenario')
    if (scenario === undefined) throw new Error('test requires --scenario')
    if (args.length > 0) throw new Error(`unexpected argument ${args[0]}`)
    const report = await runScenario(scenario)
    if (json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    else process.stdout.write(`${report.passed ? 'PASS' : 'FAIL'} ${report.scenario}: ${report.summary ?? 'no matching recovery'}\n`)
    if (!report.passed) process.exitCode = 2
    return
  }

  if (!['install', 'uninstall', 'verify'].includes(command)) throw new Error(`unknown command ${JSON.stringify(command)}`)
  if (args.length > 0) throw new Error(`unexpected argument ${args[0]}`)
  const operations = await import('../lib/installer/index.js')
  const options = { packageRoot, version: manifest.version }
  const report = command === 'install' ? operations.install(options)
    : command === 'uninstall' ? operations.uninstall(options)
      : operations.verify(options)
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else if (command === 'verify') {
    process.stdout.write(`dsh-autofix ${report.version}: ${report.publishReady ? 'ready' : 'incomplete'}\n`)
    process.stdout.write(`Prebuilt runtime: ${report.packageLoad ? 'ok' : 'failed'}\n`)
    process.stdout.write(`Installed profiles: ${report.dsh?.profiles.filter(item => item.verified).map(item => item.profile).join(', ') || 'none'}\n`)
  } else {
    process.stdout.write(`${command === 'install' ? 'AutoFix installed' : 'AutoFix removed'}: ${report.profiles.map(item => item.profile).join(', ') || 'no profiles'}\n`)
    process.stdout.write(`Configuration verified: ${report.profiles.every(item => command === 'install' ? item.verified : !item.installed) ? 'yes' : 'no'}\n`)
    process.stdout.write(`Skill ${command === 'install' ? 'installed' : 'removed'} automatically.\n`)
    process.stdout.write(`${command === 'install' ? 'Use DSH normally; supported failures can be retried now.' : 'Existing DSH tasks were not interrupted.'}\n`)
  }
  if (command === 'verify' && !report.publishReady) process.exitCode = 2
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  const requestedCommand = process.argv[2] ?? 'help'
  const profileChanges = /no existing web or headless profile was found/i.test(message)
    ? 'none'
    : ['install', 'uninstall'].includes(requestedCommand)
      ? 'possible partial change; the idempotent retry rechecks effective config'
      : 'none'
  process.stderr.write(`dsh-autofix: ${message}\n`)
  process.stderr.write(`Automatic action: stopped ${requestedCommand} at the reported failure; no running DSH task was interrupted.\n`)
  process.stderr.write(`Profile changes: ${profileChanges}.\n`)
  process.stderr.write('Safe to retry: yes; fix the reported condition and run the same command again.\n')
  process.exitCode = 1
}
