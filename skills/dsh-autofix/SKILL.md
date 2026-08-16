---
name: dsh-autofix
description: Diagnose and continue after common DeepSeek Harness failures. Use when a DSH tool failed, the user asks to 自动修复 DSH or 工具报错后继续, or an error mentions old text not found, command not found, prepare undefined, history unavailable, or plugin install failed.
license: MIT
metadata:
  author: cyanseek
  version: "0.1.0"
---

# DSH AutoFix

Keep the current task moving after a supported DSH failure. Runtime recovery is automatic; use this skill when the user pastes an error, asks for diagnosis, or the runtime cannot act because DSH did not start.

## Default workflow

1. Inspect the current error and the most recent tool result. Do not ask the user to paste information already present.
2. Run `dsh-autofix verify --json` when installation or profile placement is relevant.
3. Apply the smallest matching recovery:
   - retry one transient operation once;
   - re-read a stale file before repeating an exact edit;
   - use an equivalent command only when it is already installed;
   - follow the local DSH Error Atlas action without rewriting profile or session data.
4. Continue the original task immediately. Do not ask the user to choose a profile or read a report.
5. Report only whether recovery succeeded, what changed, and any remaining real blocker.

## Boundaries

- Never install system software, change credentials, weaken approval or sandbox policy, or modify session history.
- Never repeat the same failed operation indefinitely. One retry is the default; after a second identical failure, change approach.
- Preserve unknown errors and use existing DSH diagnostics instead of guessing.
- Ask the user only for missing credentials, a business-only decision, or uncertainty around an irreversible action.

## Advanced deterministic check

When a maintainer requests a regression reproduction, run:

```bash
dsh-autofix test --scenario transient-tool-error --json
```

Other bundled scenarios are `stale-file`, `command-alternative`, and `error-atlas`. Treat missing environment evidence as inconclusive, never as a pass.
