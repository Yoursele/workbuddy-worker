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


## 0.1.1 自动启动验收

新增启动就绪层，未运行时启动WorkBuddy.exe，已运行时复用。51项本地自动检查通过，涵盖首次连接、单次启动、有界等待、取消、启动失败、进程查询失败与信任/授权拒绝不重启。真实doctor首次返回desktop_started=true且成功读取账号模型目录，第二次应复用；这些检查不发送模型消息。其他Windows/WorkBuddy版本、永不弹窗和同时多进程冷启动行为未验证。
