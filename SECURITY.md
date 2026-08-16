# Security policy

dsh-autofix observes failed DSH tool results and can attach a model-facing recovery notice. It does not receive or require credentials, add approval decisions, change tool arguments, execute replacement commands, or write telemetry.

## Reporting a vulnerability

Do not open a public issue for a vulnerability. Use GitHub private vulnerability reporting for `cyanseek/dsh-autofix` once the repository is available. Include the affected version, minimal synthetic reproduction, impact and suggested mitigation. Remove credentials, private session logs and production data.

## In scope

- a successful or unknown tool result being changed;
- recovery bypassing DSH policy or approval behavior;
- an unbounded file read, retry loop or command execution;
- sensitive data included in a recovery context;
- installer changes outside the existing target profiles or owned Skill directories.

## Supported versions

Before the first public release, only the current development line receives fixes. A version support table will be added when multiple release lines exist.
