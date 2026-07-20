# Production Evolution Map — MII_lite → Project Echo direction

A staged path from the current prototype to a production-capable system. This is a **direction**, not a commitment to a specific architecture, and it does **not** assume MII_lite is the production design.

**Standing rule for every stage:** where a responsibility is a platform concern (tenancy, identity, eventing, durable state, audit anchoring, observability, ASR at scale, CAD transport), **check what CentralSquare already provides before building.** Items that should be verified against existing platform capabilities are marked **[VERIFY WITH CENTRALSQUARE]**.

Stages are ordered so each unblocks the next. Early stages are mostly internal refactors with low external risk; later stages depend on platform and vendor facts we don't yet have.

---

## Stage 1 — Harden domain contracts
- **Objective:** Turn the implicit-but-good domain model into stable, versioned, runtime-validated contracts so everything downstream can be replaced behind them.
- **Current code that informs it:** [src/lib/mii/types.ts](../src/lib/mii/types.ts) (the ontology), the ASR registry/adapter ([providerRegistry.ts](../src/lib/mii/asr/providerRegistry.ts), [asr/types.ts](../src/lib/mii/asr/types.ts)), gate/policy result types ([safetyGates.ts](../src/lib/mii/safetyGates.ts), [signOffPolicy.ts](../src/lib/mii/signOffPolicy.ts)), audit/export shapes ([auditExport.ts](../src/lib/mii/auditExport.ts)).
- **Preserved:** the type vocabulary, ASR capability-flag pattern, gate/policy contracts, audit event + correlation schema.
- **Replaced:** compile-time-only typing → runtime validation at boundaries; ad-hoc localStorage load guards → explicit schema versioning; the synchronous `transcribe()` signature → an async contract.
- **Principal risks:** over-formalizing before the runtime shape is known; the ASR contract change rippling into PENNY.
- **Validation criteria:** schemas validate persisted and imported payloads; a version field gates incompatible data; the async ASR contract compiles against a mock and a real provider.
- **CentralSquare dependencies:** none — internal. (Confirm any org-wide schema/versioning standard exists. **[VERIFY WITH CENTRALSQUARE]**)

## Stage 2 — Extract orchestration from the UI
- **Objective:** Move workflow sequencing out of `AudioClient` into per-workflow controllers/hooks so the domain owns transitions, not React.
- **Current code that informs it:** [src/app/audio/AudioClient.tsx](../src/app/audio/AudioClient.tsx) (`playAndProcess`, `syncActiveSession`, the `useState` cursor cluster), the store action API ([src/lib/mii/store.ts](../src/lib/mii/store.ts)).
- **Preserved:** the individual store actions and their semantics; the human-checkpoint model in [recordingProcessing.ts](../src/lib/mii/recordingProcessing.ts).
- **Replaced:** `AudioClient`'s orchestration role; local React state as workflow cursors → an explicit controller/service layer.
- **Principal risks:** behavior drift during extraction (mitigated by Stage 1 contracts + expanded tests); temptation to redesign UX simultaneously.
- **Validation criteria:** each workflow driven by a controller with unit tests; `AudioClient` reduced to view + input; no domain sequencing left in components.
- **CentralSquare dependencies:** none — internal.

## Stage 3 — Introduce durable workflow state
- **Objective:** Replace the single-browser store with server-authoritative, durable state so workflows survive refresh, sessions, and users.
- **Current code that informs it:** [src/lib/mii/store.ts](../src/lib/mii/store.ts) (`update`, `loadState`, `miiStore` action surface), `MiiState` in [processor.ts](../src/lib/mii/processor.ts).
- **Preserved:** the action API surface (as a service interface); the single-writer-per-aggregate discipline.
- **Replaced:** whole-state `structuredClone` + localStorage → a database + server state; single-session assumption → shared, multi-session state.
- **Principal risks:** concurrency/conflict handling that the current single-writer model never faced; migration of the state shape.
- **Validation criteria:** state persists across refresh and devices; two clients converge; conflict handling defined for concurrent edits.
- **CentralSquare dependencies:** durable state/system-of-record and any real-time sync/eventing service. **[VERIFY WITH CENTRALSQUARE]**

## Stage 4 — Move heavy work to asynchronous workers
- **Objective:** Take blocking work (ASR, batch processing) off the request/UI path onto queues + workers, making the "async job" real.
- **Current code that informs it:** the ASR job state machine ([processor.ts](../src/lib/mii/processor.ts) `requestAsrJob`/`advanceAsrJob`), local Whisper on the main thread ([localOfflineWhisperAdapter.ts](../src/lib/mii/asr/localOfflineWhisperAdapter.ts)).
- **Preserved:** the job lifecycle *model* (states/steps/events) as the contract a real queue implements.
- **Replaced:** synchronous one-step-per-call advancement → queue-driven workers; main-thread inference → worker/server inference with retries and dead-letter handling.
- **Principal risks:** at-least-once delivery interacting with non-idempotent writes (must land before Stage 8); observability gaps hiding stuck jobs.
- **Validation criteria:** jobs process off-thread; retries and DLQ exercised; job status observable end-to-end.
- **CentralSquare dependencies:** message bus/queue and worker-hosting standards. **[VERIFY WITH CENTRALSQUARE]**

## Stage 5 — Add tenant-aware configuration
- **Objective:** Replace hardcoded agency assumptions with tenant context propagated through every layer.
- **Current code that informs it:** hardcoded `TENANT`/`AGENCY` ([seed.ts](../src/lib/mii/seed.ts)), single global `demoPolicy` ([signOffPolicy.ts](../src/lib/mii/signOffPolicy.ts)), single-agency dictionary/zone tables ([dictionary.ts](../src/lib/mii/dictionary.ts), [zoneMapper.ts](../src/lib/mii/zoneMapper.ts)).
- **Preserved:** the tenant/agency *fields* on the incident and the `SignOffPolicyMode` enum + gate contract.
- **Replaced:** constants → tenant context on operations; global policy → per-tenant policy store; single-agency tables → per-tenant config.
- **Principal risks:** cross-tenant leakage if context isn't enforced at the data layer; config sprawl.
- **Validation criteria:** all reads/writes scoped by tenant; a second agency runs with isolated config/policy; no shared mutable defaults.
- **CentralSquare dependencies:** tenancy/provisioning service and isolation model (per-db / per-schema / row-level). **[VERIFY WITH CENTRALSQUARE]**

## Stage 6 — Integrate authorized audio sources
- **Objective:** Replace browser file/blob intake with real, authorized recording ingestion (e.g. Eventide/Barix-style) and durable audio storage.
- **Current code that informs it:** audio intake ([processor.ts](../src/lib/mii/processor.ts) `addAudioAsset`), provenance fields on `AudioAsset` ([types.ts](../src/lib/mii/types.ts) L259–276), session-local blob URL caveat, recording-session model ([recordingProcessing.ts](../src/lib/mii/recordingProcessing.ts)).
- **Preserved:** the provenance field concept and the human-checkpoint session model.
- **Replaced:** browser file + blob URL (lost on refresh) → durable object storage + real source metadata and authorization validation.
- **Principal risks:** authorized-recording/consent validation rules we don't have; audio retention and access control.
- **Validation criteria:** audio persists and is retrievable; source authorization is validated and recorded in provenance; retention policy applied.
- **CentralSquare dependencies:** Eventide (or equivalent) integration behavior and object-storage/retention services. **[VERIFY WITH CENTRALSQUARE]**

## Stage 7 — Add production ASR evaluation and selection
- **Objective:** Establish an evaluation methodology and select a production ASR strategy; make provider selection policy-driven.
- **Current code that informs it:** the provider registry ([providerRegistry.ts](../src/lib/mii/asr/providerRegistry.ts)), the experimental Whisper path, PENNY quality evaluation ([penny.ts](../src/lib/mii/penny.ts) `evaluateAsrResultForPenny`).
- **Preserved:** the registry/adapter seam; PENNY's quality-issue taxonomy as the review contract.
- **Replaced:** fabricated/placeholder confidence → real calibrated confidence; unproven local Whisper → an evaluated provider (cloud fleet or on-device pool); fixed thresholds → calibrated, tenant/provider-aware policy.
- **Principal risks:** no labeled corpus to evaluate against; measuring WER instead of operational field accuracy; on-device vs cloud decided without the offline/latency requirements.
- **Validation criteria:** an eval set exists; providers scored on operational field accuracy (nature/address/unit), not just WER; selection driven by policy with a documented bar.
- **CentralSquare dependencies:** production ASR strategy, any existing ASR service, and access to labeled authorized radio traffic. **[VERIFY WITH CENTRALSQUARE]**

## Stage 8 — Add a real One Solution (CAD) adapter
- **Objective:** Replace the mock CAD builder with a real, reliable CAD write path.
- **Current code that informs it:** [mockCad.ts](../src/lib/mii/mockCad.ts) (`buildMockCadPayload`, field shape, redaction), `submitMockCad` ([processor.ts](../src/lib/mii/processor.ts) L761–781).
- **Preserved:** the payload field shape as a draft schema and the sensitive-field redaction rule.
- **Replaced:** in-memory "NOT SENT" builder → a real adapter with transport, auth, idempotency keys, retries, dead-letter handling, and reconciliation against the system of record.
- **Principal risks:** duplicate or lost writes to a live CAD if idempotency (Stage 4/1) isn't solid; assuming One Solution semantics instead of verifying them.
- **Validation criteria:** writes are idempotent and reconciled; failures retried and dead-lettered; no duplicate incidents under retry; redaction preserved on the wire.
- **CentralSquare dependencies:** One Solution API behavior (idempotency, ack model, reconciliation) and any CentralSquare eventing/orchestration in front of CAD. **[VERIFY WITH CENTRALSQUARE]**

## Stage 9 — Add production identity, security, and audit controls
- **Objective:** Replace demo auth and keyless verification with real identity, authorization, and a defensible audit chain.
- **Current code that informs it:** demo auth ([demoAuth.ts](../src/lib/demoAuth.ts), [proxy.ts](../src/proxy.ts)), hardcoded reviewer ([store.ts](../src/lib/mii/store.ts) `REVIEWER`), keyless integrity ([hash.ts](../src/lib/mii/hash.ts), [auditExport.ts](../src/lib/mii/auditExport.ts)).
- **Preserved:** the sign-off *mechanism* and semantics; the canonicalization and verify-flow shape; the audit event/correlation schema.
- **Replaced:** shared static token → real authN/authZ; hardcoded reviewer → authenticated identity bound to sign-off; unkeyed self-hash → keyed signature/HMAC + trusted timestamp + external anchoring; mutable audit array → append-only durable store.
- **Principal risks:** identity integration complexity; retention/chain-of-custody requirements we don't yet have; getting "defensible record" legally right.
- **Validation criteria:** sign-off attributable to a real user; audit entries signed and externally anchored with trusted time; tamper attempts detectable against an authority, not just a self-hash.
- **CentralSquare dependencies:** identity provider, signing/timestamp authority, immutable/audit-anchoring storage, and legal retention/chain-of-custody requirements. **[VERIFY WITH CENTRALSQUARE]**

## Stage 10 — Add observability, replay, load testing, and failure testing
- **Objective:** Make the system operable and its behavior measurable under real and adverse conditions.
- **Current code that informs it:** the audit/correlation model ([audit.ts](../src/lib/mii/audit.ts)), the scenario replay ([processor.ts](../src/lib/mii/processor.ts) `startScenarioReplay`), the domain harness ([scripts/verify-mii.ts](../scripts/verify-mii.ts)).
- **Preserved:** correlation IDs as a tracing seed; the harness as a domain regression spec; determinism as a replay aid.
- **Replaced:** audit-as-telemetry → real metrics/tracing/centralized logging; demo scenario replay → event-log-based operational replay; domain-only harness → full pyramid (unit + integration + UI + e2e + real-ASR) plus load and failure/chaos testing.
- **Principal risks:** treating provenance audit as observability; no SLOs defined; load/failure characteristics unknown until measured (never quote a capacity number before this).
- **Validation criteria:** traces span UI→worker→CAD; SLOs defined and measured; load tests establish real capacity; failure injection exercises retries/DLQ/recovery; operational replay reconstructs state from the event log.
- **CentralSquare dependencies:** observability stack, SLO framework, and any platform load/chaos tooling. **[VERIFY WITH CENTRALSQUARE]**

---

### Sequencing rationale (say this if asked)
"Stages 1–4 are mostly internal and de-risk everything else: stable contracts, orchestration out of the UI, durable state, real async workers. Idempotency has to be solid *before* a real CAD adapter, so Stage 4 precedes Stage 8. Tenancy (5) comes before external integrations so nothing is built single-tenant and retrofitted. The vendor- and platform-heavy stages (6–10) depend on facts I don't have yet — which is exactly why they're gated on checking CentralSquare's existing services first."
