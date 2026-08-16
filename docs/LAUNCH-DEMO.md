# Launch demo

The launch story is one sentence: **DSH tools fail. Your task keeps going.**

## Demo 1 — transient web failure

Show one `HTTP 502` tool result, the AutoFix recovery notice, one immediate retry and the successful final task result. Do not show configuration or test instrumentation.

## Demo 2 — stale edit

Change a fixture file between read and edit. Show `old text not found`, the bounded refreshed excerpt and the successful exact edit on the next attempt.

## Demo 3 — cross-platform command

Run a fixture where `rg` is unavailable and one mapped alternative is present. Show AutoFix selecting the installed command and the task continuing without installing software.

Each demo must use synthetic data, show the original error, and avoid claims beyond the compatibility matrix.
