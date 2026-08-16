import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')

test('package identity, exports, bundle and install lifecycle match dsh-autofix', () => {
  const manifest = JSON.parse(read('package.json'))
  assert.equal(manifest.name, 'dsh-autofix')
  assert.equal(manifest.description, 'Automatic recovery for common DeepSeek Harness tool errors — zero prompts, zero config.')
  assert.deepEqual(Object.keys(manifest.bin), ['dsh-autofix'])
  assert.deepEqual(Object.keys(manifest.exports), ['.', './recipes', './testkit', './package.json'])
  assert.equal(manifest.scripts.prepare, undefined)
  assert.match(manifest.scripts.prepack, /build/)
  assert.equal(manifest.repository.url, 'git+https://github.com/cyanseek/dsh-autofix.git')
  assert.equal(read('cordis.patch.yml'), '- insert:\n    - id: autofix\n      name: dsh-autofix\n      config: {}\n')
})

test('English README is result-first and has one ordinary-user install command', () => {
  const text = read('README.md')
  assert.match(text, /^# dsh-autofix\n/)
  assert.match(text, /> Fix common DSH failures automatically and keep the task moving\./)
  const install = /## Install\n([\s\S]*?)\n## /.exec(text)?.[1]
  assert.ok(install)
  assert.deepEqual(install.match(/npx -y dsh-autofix install/g), ['npx -y dsh-autofix install'])
  const headings = ['## Install', '## Before and after', '## Recovery recipes', '## Zero-interruption contract', '## Compatibility', '## Advanced Test Kit', '## Development and contributing', '## License']
  assert.deepEqual(headings.map(heading => text.indexOf(heading)), headings.map(heading => text.indexOf(heading)).slice().sort((a, b) => a - b))
  for (const demo of ['A web tool returns 502', 'A file changes during an edit', 'A command differs across platforms']) assert.match(text, new RegExp(demo))
})

test('Chinese README mirrors the public information architecture', () => {
  const text = read('README.zh-CN.md')
  assert.match(text, /^# dsh-autofix\n/)
  assert.match(text, /> DSH 报错后别停：自动重试、自动刷新、自动换路，任务继续跑。/)
  const install = /## 安装\n([\s\S]*?)\n## /.exec(text)?.[1]
  assert.deepEqual(install.match(/npx -y dsh-autofix install/g), ['npx -y dsh-autofix install'])
  const headings = ['## 安装', '## 使用前后', '## 恢复 Recipe', '## 零打断契约', '## 兼容性', '## 高级 Test Kit', '## 开发与贡献', '## 许可证']
  assert.deepEqual(headings.map(heading => text.indexOf(heading)), headings.map(heading => text.indexOf(heading)).slice().sort((a, b) => a - b))
  assert.equal((read('README.md').match(/^## /gm) ?? []).length, (text.match(/^## /gm) ?? []).length)
})

test('public docs contain no Local paths or obsolete ordinary-user surfaces', () => {
  const publicFiles = [
    'README.md', 'README.zh-CN.md', 'CONTRIBUTING.md', 'CONTRIBUTING.zh-CN.md',
    'CHANGELOG.md', 'SECURITY.md', 'SUPPORT.md', 'docs/COMPATIBILITY.md',
    'docs/LAUNCH-DEMO.md', 'docs/GITHUB-METADATA.md', 'docs/MIGRATION.md',
    'docs/RELEASE-NOTES-0.1.0.md',
  ]
  for (const path of publicFiles) {
    const text = read(path)
    assert.doesNotMatch(text, /mydoc|[A-Z]:\\|\/mnt\/e\/Project/i, path)
  }
  for (const removed of ['bin/dsh-tool-chaos.mjs', 'docs/CLI.md', 'prompts/run-experiment.md', 'schemas/scenario.schema.json']) {
    assert.equal(existsSync(removed), false, removed)
  }
})

test('community Recipe form and bundled Skill include the required fields and triggers', () => {
  const issue = read('.github/ISSUE_TEMPLATE/recipe.yml')
  for (const id of ['error', 'dsh', 'os', 'tool', 'manual', 'expected', 'reproduction']) assert.match(issue, new RegExp(`id: ${id}`))
  const skill = read('skills/dsh-autofix/SKILL.md')
  assert.match(skill, /^name: dsh-autofix$/m)
  for (const trigger of ['DSH tool failed', 'DeepSeek Harness', 'old text not found', 'command not found', 'history unavailable']) assert.match(skill, new RegExp(trigger))
})
