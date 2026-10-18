# Validation scope — 2026-10-18

## Observed on one Windows installation

- WorkBuddy-bundled CLI startup and authenticated account model catalog lookup via the desktop broker.
- Background completion with a fresh marker and correct 17×23 arithmetic.
- Two runs of synthetic CSV grouping, independently matched with exact expected counts, non-missing counts, wins and arithmetic means.
- Same-ID reuse, conflicting-ID refusal, pre-start cancellation and cleanup of owned CLI processes and temporary workspaces.

## Offline checks

The original 32 local checks cover input restrictions, result parsing, a misleading zero exit, empty/missing results, environment scrubbing, tool-request filtering, tool-response rejection, isolated subprocess timeout and running cancellation. Release packaging adds deterministic install/ZIP/vendor-source checks.

A real 5-second timeout probe completed before its deadline, so it does NOT count as a real supplier-timeout test. Timeout/cancellation control flow was tested with an isolated local CLI substitute. Currency cost was not verified; token usage came from the upstream report. The requested and CLI-announced model ID was deepseek-v4.1-flash; no separate supplier model-version proof was available.

No task IDs, machine paths, chat transcripts, account identifiers, private source, tokens or real research inputs are part of this repository.

## Not established

Compatibility with every WorkBuddy release/account/model, Linux/macOS live usage, sustained parallel operation, restart/PID-reuse recovery, real billing deltas, formal security isolation or strategy/trading effectiveness.
