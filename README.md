# dsh-autofix

> Development version `0.1.1` (GitHub source; no npm release): tested locally on Windows Node.js 24.11.1 with DSH `0.1.7-rc.2` (2026-09-28). Approval denials and blocked results never trigger recovery; installation uses the running package and verifies upgrades. Model-backed end-to-end and native macOS runs have not been repeated.

[简体中文](README.zh-CN.md)

> Fix common DSH failures automatically and keep the task moving.

Install it once, then use DeepSeek Harness exactly as before. Supported failures get one clear recovery action; unknown failures stay unchanged.

- Transient web or API error: retry once
- File changed during an edit: refresh the current context
- Command missing on this OS: use an installed equivalent
- Known DSH error: give the agent an executable next action

## Install

```bash
npx -y github:cyanseek/dsh-autofix install
```

Done. Use DSH normally.

## Before and after

### A web tool returns 502

```text
Before: HTTP 502 → task pauses → user says "continue"
After:  HTTP 502 → AutoFix requests one retry → task continues
```

### A file changes during an edit

```text
Before: old text not found → user relays the error → agent reads again
After:  old text not found → AutoFix refreshes a bounded excerpt → agent edits again
```

### A command differs across platforms

```text
Before: rg not found → task stops
After:  rg not found → AutoFix finds an installed equivalent → agent continues
```

## Recovery recipes

| Recipe | Recognizes | Action |
| --- | --- | --- |
| Transient tool error | Rate limits, selected 408/5xx responses, timeouts, transport resets | Ask the agent to retry the same operation once, then change approach |
| Stale file context | Exact stale-edit and replacement-miss errors | Attach a bounded current excerpt when DSH's filesystem service is available |
| Command alternative | Command-not-found errors from shell tools | Recommend the first equivalent that actually exists on the current PATH |
| DSH Error Atlas | A controlled, versioned set of common DSH errors | Attach a short next action without rewriting profile or session data |

The public catalog is in [`recipes/catalog.json`](recipes/catalog.json). New recipes are welcome through the [recipe request form](https://github.com/cyanseek/dsh-autofix/issues/new?template=recipe.yml).

## Zero-interruption contract

dsh-autofix works only after a tool has already failed. It does not add approval prompts, change tool arguments, alter successful results, install system commands, require another service, or add a UI.

Each matching failure receives at most one recovery intervention in a short window. A second identical failure remains visible so the agent can change approach. Cancellation stops pending recovery work, and uninstall removes the plugin and bundled Skill.

Unknown failures are preserved unchanged.

## Compatibility

Current candidate: 58 tests pass, including the real DSH ToolRuntime, approval-denial and downstream-block regressions. TypeScript 7.0.2 builds with explicit Node types. Earlier version/platform evidence remains in the compatibility matrix.

See the [compatibility matrix](docs/COMPATIBILITY.md) for exact evidence and limits.

## Advanced Test Kit

Maintainers can run one bundled deterministic recovery check:

```bash
dsh-autofix test --scenario transient-tool-error --json
```

Available scenarios are `transient-tool-error`, `stale-file`, `command-alternative`, and `error-atlas`.

Plugin authors can import the stable Recipe interface:

```ts
import { applyRecipes } from 'dsh-autofix'
import type { AutoFixRecipe } from 'dsh-autofix/recipes'

const recipes: AutoFixRecipe[] = [myRecipe]
applyRecipes(ctx, recipes)
```

Use this advanced entry point in one custom bundle instead of mounting the default bundle alongside it. Recipes run by descending priority and duplicate IDs fail immediately.

The previous deterministic fault engine remains available for advanced regression tests:

```ts
import { ChaosEngine } from 'dsh-autofix/testkit'
```

The Test Kit is not part of the normal user workflow.

## Development and contributing

```bash
npm ci --ignore-scripts
npm run check
```

A recovery contribution is intentionally small: one Recipe, one deterministic regression test, and one concise catalog entry. Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change.

## License

[MIT](LICENSE)
