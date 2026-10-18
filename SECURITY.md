# Security and privacy

This community integration uses WorkBuddy's internal local-account broker. Keep the desktop app up to date. Do not use unknown copies of the application or share its runtime/IPC directory.

- Model requests are limited to explicitly supplied text. No model tools are exposed. Tool definitions are removed and actual tool-call responses rejected.
- A per-task authenticated proxy binds only to 127.0.0.1. Authentication values are transient and are not supplier API keys. Other account, configuration and upload routes are rejected.
- Common sensitive paths, symlinks, binary/large input and obvious secret patterns are refused. This is NOT complete DLP: review task text and files before submission.
- Input and output are stored locally in plaintext. Same-user malware and an administrator are outside the threat model. Restrict access and do not sync job directories publicly.
- Model output is untrusted. Do not execute returned commands or patches automatically.
- Cancellation/timeout cannot establish that no upstream charge occurred. Unknown jobs are not replayed automatically.
- PID reuse, abrupt shutdown, multi-user access and durable recovery are not fully handled. This is not a general OS sandbox or a financial execution engine.
- Never include credentials, runtime metadata, private prompts or customer data in public bug reports. Report only sanitized versions, error codes and synthetic reproductions.

There is no formal security response SLA. For a sensitive issue, contact the repository owner through an available private GitHub contact channel; avoid a public disclosure containing user data.
