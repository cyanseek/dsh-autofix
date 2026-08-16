#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const root = resolve('skills/dsh-autofix')
const errors = []
const skillPath = resolve(root, 'SKILL.md')
const agentPath = resolve(root, 'agents/openai.yaml')

if (!existsSync(skillPath)) errors.push('missing skills/dsh-autofix/SKILL.md')
if (!existsSync(agentPath)) errors.push('missing skills/dsh-autofix/agents/openai.yaml')

if (existsSync(skillPath)) {
  const text = readFileSync(skillPath, 'utf8')
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)?.[1]
  if (frontmatter === undefined) errors.push('SKILL.md is missing YAML frontmatter')
  else {
    const name = /^name:\s*([^\r\n]+)$/m.exec(frontmatter)?.[1]?.trim()
    const description = /^description:\s*([^\r\n]+)$/m.exec(frontmatter)?.[1]?.trim()
    if (name !== 'dsh-autofix') errors.push('skill name must be dsh-autofix')
    if (description === undefined || description.length === 0 || description.length > 1024) {
      errors.push('skill description must contain 1..1024 characters')
    }
    for (const trigger of ['DeepSeek Harness', 'old text not found', 'command not found', 'history unavailable']) {
      if (!description?.includes(trigger)) errors.push(`skill description is missing trigger: ${trigger}`)
    }
  }
  if (text.split(/\r?\n/).length > 500) errors.push('SKILL.md exceeds 500 lines')
}

if (existsSync(agentPath)) {
  const text = readFileSync(agentPath, 'utf8')
  for (const field of ['display_name:', 'short_description:', 'default_prompt:', 'allow_implicit_invocation:']) {
    if (!text.includes(field)) errors.push(`agents/openai.yaml is missing ${field}`)
  }
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`skill validation: ${error}\n`)
  process.exit(1)
}
process.stdout.write('skill validation: PASS (skills/dsh-autofix)\n')
