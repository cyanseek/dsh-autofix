# Contributing to dsh-autofix

[简体中文](CONTRIBUTING.zh-CN.md)

Thanks for helping DSH tasks recover with fewer interruptions.

## Start with a Recipe request

Use the Recipe issue form for a new error class. Include the complete redacted error, exact DSH/Node/OS versions, tool name, current manual recovery and a minimal reproduction. Never include credentials or private session data.

A good contribution contains:

1. one narrowly matched Recipe;
2. one deterministic regression test;
3. one concise entry in `recipes/catalog.json`.

Unknown errors must remain unchanged. A Recipe must not add approvals, install software, rewrite arbitrary commands, mutate profile/session data or modify successful tool results.

## Development

Requirements: Node.js 22.19+ and npm.

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify
npm pack --dry-run
```

`npm run check` runs the complete local gate. Tests use synthetic data and deterministic fixtures; do not point them at a personal or production profile.

## Recipe interface

Recipes implement the exported `AutoFixRecipe` interface. Matching must prefer structured error fields and controlled signatures. Recovery returns a short next action or no action; it must observe cancellation and must never replace the original tool result.

## Pull requests

Describe the user interruption being removed, the exact match boundary, evidence for success/unknown-error transparency, compatibility impact and rollback. Keep bilingual public documents synchronized when user-facing behavior changes.
