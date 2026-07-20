# One-Page Hit Sheet — MII_lite

**Frame:** Sound domain concepts, honestly-labeled browser-local prototype. Not the production architecture; not runtime-scalable.

### Architecture flow
Audio intake → ASR provider select → ASR job lifecycle → **PENNY** quality eval → human review → sign-off → transcript attach → incident processing → safety/policy gates → **mock** CAD → audit export → verify. *All client-side; state in one localStorage store; reasoning is deterministic (regex/rules), no LLM in the pipeline.*

### Five strongest decisions
1. Deterministic, explainable engine — a rationale on every inference.
2. **PENNY** trust boundary — no transcript touches an incident without quality-gating + sign-off, provider-agnostic.
3. Safety gates single-sourced — visible gates can't diverge from what blocks Submit.
4. Human-in-the-loop enforced in code — override needs a note; sign-off throws until resolved.
5. Clean single-writer store + pure engine — one auditable transition per action.

### Five most important weaknesses
1. Audit "integrity" is a keyless, forgeable self-hash (not a signature).
2. `AudioClient.tsx` god component (1475 lines, 8 workflows) — orchestration lives in the UI.
3. Real local Whisper unproven & unshippable (weights absent, untested) and bypasses its own ASR abstraction.
4. Single-browser, in-memory, no server/queue/worker, no tenant isolation.
5. No CAD interface/idempotency; sign-off identity is a hardcoded string.

### Does it scale?
Concept yes — domain model, ASR seam, PENNY boundary, gate/policy contracts, audit schema carry forward. **Runtime no** — single-session, whole-state clone, localStorage, no server/queue/worker/tenancy. Runtime pieces get **replaced, not tuned.**

### What breaks first?
The main thread + growing whole-state clone within a session, and local Whisper blocking the UI. Structurally, it can't do multi-user at all.

### What would you rewrite first?
`AudioClient` orchestration and the store's persistence — pull workflow out of the UI, put durable state behind the same action API, harden contracts alongside.

### Why is PENNY separate from ASR?
ASR is a replaceable, fallible engine. The "is this transcript trustworthy enough to touch an incident" decision must live in one auditable place, independent of the engine. PENNY is that boundary — it never does ASR, creates incidents, or writes CAD.

### What do the 108 checks prove?
The deterministic domain logic behaves as designed — extraction, ASR job + PENNY state machines, gates, tamper-evidence, incl. failure/override paths. **Not** UI, store, persistence, real Whisper, concurrency, or e2e.

### Is CAD real?
No. Local JSON builder with redaction, stored in memory, audited "NOT SENT." No One Solution/CentralSquare client, transport, idempotency, retry, or reconciliation.

### Is the audit signed?
No. Unkeyed SHA-256 embedded in the file — local tamper-evidence. Public algorithm, no key → forgeable. Not chain of custody.

### Three questions for CentralSquare
1. What tenancy, identity, eventing/queue, and durable-state services already exist that I should build on rather than rebuild?
2. What are One Solution's write semantics — idempotency keys, ack model, reconciliation — and is there CentralSquare orchestration in front of CAD?
3. What's the production ASR strategy (cloud vs on-device), and do we have labeled authorized radio traffic for an evaluation set?

### Do-not-claim reminders
Not production-scalable · Whisper not validated on real audio · audit not signed / no chain of custody · no live One Solution · not multi-tenant · harness ≠ e2e · ASR jobs not truly async/distributed · no capacity/channel numbers · not the Project Echo production architecture · review can't be safely bypassed · demo auth ≠ access control.
