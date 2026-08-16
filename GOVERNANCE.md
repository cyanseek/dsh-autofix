# Governance

## Model

The project is maintainer-led and evidence-driven. Maintainers are responsible for releases, security response, roadmap prioritization, compatibility claims, and stewardship of the project name.

## Decision levels

- **Routine changes:** one maintainer review plus passing gates.
- **Public contract changes:** design issue, compatibility analysis, tests, and changelog entry.
- **High-risk changes:** broader matching, new mutation authority, installation behavior, or transparency-contract changes require an RFC-style issue and at least seven days for public review when practical.
- **Security changes:** may be developed privately and disclosed after a fix.

## Maintainer selection

Sustained contributors may be invited based on technical judgment, review quality, reliability, community conduct, and demonstrated care for safety—not commit count alone.

## Releases

- SemVer is used.
- DSH is pre-stable, so compatibility is stated as an explicit tested matrix.
- Stable releases require real consumer smoke evidence, signed/provenance-enabled packages, changelog, and rollback notes.
- A maintainer must not claim support for an untested DSH line.

## Project assets

Domains, package names, signing credentials, social accounts, and release tokens should be controlled by at least two maintainers when the project grows beyond one maintainer. Access follows least privilege.
