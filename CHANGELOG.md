# Changelog

All notable changes are documented here.

## [Unreleased]

## [0.1.0] - 2026-08-16

### Added

- Automatic recovery notices for transient tool errors, stale file edits, installed command alternatives and a versioned DSH Error Atlas.
- One-command installation for existing `web` and `headless` profiles, including effective-config verification and automatic Skill installation.
- Public Recipe API with an ordered `applyRecipes` integration entry point, recipe catalog, deterministic scenarios and real DSH ToolRuntime consumer tests.
- Bilingual README, compatibility matrix, launch demos and community Recipe request form.

### Changed

- Repositioned the project from fault injection to automatic recovery.
- Moved the deterministic Chaos Engine to the advanced `dsh-autofix/testkit` export.
- Changed the default from disabled/dry-run scenarios to an enabled zero-config AutoFix runtime.
- Removed scenario configuration and the previous multi-command CLI from the ordinary user workflow.

### Not included

- Provider-level transparent retries, cold-start repair, profile/session rewriting, automatic software installation, approval flows, a background service or a UI.
- A standalone Windows client run and native macOS release-candidate installation verification.

[Unreleased]: https://github.com/cyanseek/dsh-autofix/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cyanseek/dsh-autofix/releases/tag/v0.1.0
