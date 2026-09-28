# Compatibility

## Current candidate — September 28, 2026

Windows Node.js 24.11.1 and real DSH ToolRuntime 0.1.7-rc.2: 58 tests, strict typecheck, build, Skill validation, CLI verification and package inspection pass. TypeScript 7.0.2 uses explicit Node 22 types. PTC tests use a synthetic execution provider with the real registry; they do not represent a live model run. New Linux/macOS and model-backed end-to-end validation remains pending. Isolated real DSH 0.1.7-rc.2 profile installation, effective-config inspection, and removal also pass. AutoFix additionally passes repeat-install with no changes and verifies the installed version. All older rows below are historical evidence.


This matrix reports evidence produced in the repository; it is not a promise about untested combinations.

| Surface | Version or platform | Status | Evidence / limit |
| --- | --- | --- | --- |
| DSH Tool Runtime | `@deepseek-ai/dsh-tools 0.1.0-rc.6` | Verified | Real registry consumer covers success, failure, additional context, nested identity, composition order, and final result count |
| DSH Tool Runtime | `0.1.0-rc.5` | API reviewed | Public post-result contract inspected in the local official source; not executed as the release consumer |
| Node.js | `24.19.0` | Verified on Linux/WSL | Strict typecheck, build, 54 tests, CLI matrix, pack and consumer tests |
| Node.js | `22.19.0` | Verified on Windows | Strict typecheck, build, and the same 54-test suite, including real DSH rc.6 ToolRuntime and Code Mode |
| pnpm | DSH-managed profile install | Verified in isolation | Real DSH rc.6 profile install, repeat-install no-op, effective-config inspection, and clean uninstall passed without changing a user profile |
| Linux / WSL | x86-64 | Verified | Current development and packaging environment |
| Windows | native CLI via WSL interoperability | Verified in isolation | Windows Node.js and `cmd` completed the real DSH profile lifecycle; standalone client boot remains unverified |
| macOS | native | Fixture only | An explicit Darwin POSIX PATH fixture is covered; native DSH profile install remains unverified |

## Development refresh — September 12, 2026

Windows Node.js `24.11.1`, DSH tools/LLM/system-prompt `0.1.0-rc.8`: `npm run check` passes strict typechecking, build, all 55 unit/CLI/consumer tests, Skill validation, verification, and tarball inspection. The real rc.8 registry exercises result handling, context, nested identity, and composition. This run does not re-establish the historical real-profile or headless evidence above for rc.8; those remain rc.6 results.

## Recipe coverage

| Recipe | Verified behavior | Current limit |
| --- | --- | --- |
| Transient tool error | Structured codes, selected HTTP statuses, controlled transport messages, deduplication, cancellation, success reset | One agent-driven retry; no provider-level transparent retry |
| Stale file context | Structured path extraction, bounded stream/read, relevant excerpt, missing-service fallback, disposal cancellation | No fuzzy edit and no path guessed from error prose |
| Command alternative | Real PATH/PATHEXT probe, cache and expiry, Windows builtins, no install or argument rewrite | Fixed initial equivalence map only |
| DSH Error Atlas | Nine versioned signatures and short next actions | Runtime does not repair cold-start, profile, or session files |

## Package contract

- Node.js: `^22.19.0 || >=24.0.0`
- Cordis: `~4.0.4`
- DSH LLM and Tools: `0.1.7-rc.2`
- Schemastery: `~3.18.4`

Open a compatibility report with exact DSH, Node.js, package-manager and OS versions when validating another combination.
