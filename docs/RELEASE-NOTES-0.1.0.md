# dsh-autofix 0.1.0 — draft release notes

DSH tools fail. Your task keeps going.

This first release adds zero-config recovery for four common failure groups: transient tool errors, stale file edits, missing cross-platform commands and selected DSH runtime errors. Installation discovers existing `web` and `headless` profiles, verifies effective configuration, and installs the bundled `$dsh-autofix` Skill.

Successful and unknown tool results remain unchanged. AutoFix does not add approvals, alter tool arguments, install system software, rewrite profile/session data or add a UI.

The deterministic fault-injection engine from the predecessor project remains available under `dsh-autofix/testkit` for maintainers. Linux/WSL on Node 24 and Windows on Node 22 pass the complete local matrix; a standalone Windows client run and native macOS installation are not yet verified. See the compatibility matrix for the exact evidence.
