# Known Limitations

Current prototype limitations of MII_lite. This document is intentionally candid — it describes what the system does not do, where it falls short, and what would need to change for production use.

## Runtime

- **Browser-local execution** — all domain logic runs on the client; no server-side processing
- **Single-user, single-session** — one browser tab, one state instance, no concurrent users
- **Singleton state** — `miiStore` is a single in-memory object; state grows with session activity
- **localStorage persistence** — state survives page refresh but is browser-local and size-limited
- **Session-local blob URLs** — audio blob URLs are lost on page refresh (state persists, media does not)
- **No durable shared persistence** — no database, no server-side state, no sync across sessions
- **No concurrency or distributed workflow validation** — the prototype has never been tested under concurrent load or multi-process execution
- **Whole-state clone on mutation** — every action clones the full state; performance degrades as state grows within a session

## AI and ASR

- **Mock providers** — four of five ASR providers are mocks that return seeded transcript data with fabricated confidence values
- **Experimental local Whisper** — browser-local Transformers.js/WASM Whisper-tiny path exists but has not been validated
- **Model assets not shipped** — Whisper model weights are excluded from the repository via `.gitignore`
- **Real inference not covered by automated verification** — the 108-check harness tests the ASR state machine and handoff but does not run real Whisper inference
- **No authorized-radio evaluation** — local Whisper has not been evaluated against real authorized radio traffic
- **No calibrated production confidence** — confidence values in mock providers are fabricated; the local Whisper path uses a conservative placeholder (0.7) to force human review
- **`.mov` ingest not validated** — audio file format support beyond standard browser codecs has not been verified
- **Synchronous ASR advancement** — ASR job steps advance synchronously per call; no queue, no workers, no distributed processing

## Workflow and Identity

- **Demo reviewer identity** — the reviewer is a hardcoded string (`"Dispatcher (you)"`), not an authenticated user
- **Demo authentication** — a shared static access code with hardcoded fallback values; this is a demo gate, not production access control
- **No role-based access control** — no user roles, no permission levels, no authorization model
- **No enterprise authorization** — no integration with identity providers, SSO, or organizational directory services
- **No multi-agency configuration** — tenant and agency are hardcoded constants (`Sunny Isles Beach`, `SIBPD`); a single dictionary and rule set applies

## CAD

- **No live One Solution integration** — the CAD payload is a mock JSON object built locally
- **No transport** — the payload is not sent to any external system
- **No idempotency** — no idempotency keys, deduplication, or exactly-once semantics
- **No retries** — no retry logic, backoff, or failure recovery
- **No acknowledgements** — no confirmation that a downstream system received or accepted the payload
- **No reconciliation** — no mechanism to verify consistency between local state and an external CAD system

## Audit

- **Mutable in-memory audit state** — audit events are stored in an in-memory array that is append-only by convention, not by enforcement; the client can mutate the array
- **Local SHA-256 integrity only** — the export includes an unkeyed SHA-256 hash for tamper-evidence, but this is not a cryptographic signature (no key, publicly reproducible, forgeable by anyone with the algorithm)
- **No identity-backed signature** — there is no private key, certificate, or authenticated signing process
- **No trusted timestamp** — timestamps come from the client's local clock, which can be manipulated
- **No immutable external anchor** — no write to an external immutable store (e.g., append-only log, blockchain, third-party timestamp authority)
- **No legal chain-of-custody claim** — the current mechanism provides local tamper-evidence for demo purposes only

## Verification

- **108 domain checks** — the `verify-mii.ts` harness covers extraction, state machines, gates, audit integrity, PENNY review, and failure paths
- **No UI automation** — no React component tests, no browser-based test runner, no visual regression
- **No store or persistence tests** — localStorage round-trip and `useSyncExternalStore` integration are not tested
- **No real Whisper inference test** — the harness tests handoff and safe degradation when the model is absent, not actual transcription accuracy
- **No concurrency, load, or resilience testing** — single-session prototype has never been stress-tested
- **No production deployment validation** — no smoke tests against deployed environments, no Netlify-specific verification

## Code Structure

- **AudioClient orchestration concentration** — `AudioClient.tsx` (~1,475 lines) handles recording, ASR provider selection, PENNY review, and transcript attachment in a single component; orchestration logic should be extracted
- **processor.ts concentration** — the incident processing engine (~1,424 lines) handles extraction, classification, conflict detection, and CAD construction in one module
- **Conceptual seams without formal interfaces** — module boundaries exist by convention (file separation, type contracts) but are not enforced by dependency injection, interface declarations, or service boundaries
- **Single-agency rules and dictionary** — extraction patterns, code dictionaries, and zone mappings are hardcoded for one agency; generalization requires expansion
