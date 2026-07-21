# Architectural Decisions

Key design decisions in MII_lite, their reasoning, and their relationship to production evolution.

This is not a formal ADR catalog. Each entry explains why the prototype is shaped the way it is.

---

## 1. Browser-local execution

**Decision:** All domain logic runs client-side in the browser. The Next.js server serves static assets and a demo-auth cookie gate.

**Reasoning:** The goal was to prove the domain model and workflow without coupling to a platform. A browser-local runtime eliminates infrastructure dependencies and lets a single engineer iterate on domain semantics without provisioning services.

**What it validates:** The domain logic is self-contained and does not require server state, external services, or network calls to produce correct results.

**What survives:** The domain modules (`processor.ts`, `penny.ts`, `safetyGates.ts`, etc.) are portable pure functions that take state in and return state out. They do not depend on the browser runtime.

**What changes for production:** The runtime moves server-side. A durable state store replaces localStorage, a message queue replaces synchronous advancement, and authenticated server processes replace browser-local execution.

---

## 2. Deterministic incident processing

**Decision:** Incident processing uses deterministic rules (regex extraction, pattern matching, dictionary lookup) with no LLM or probabilistic model in the processing pipeline.

**Reasoning:** Every inference must carry a rationale. Deterministic rules make the system explainable — each extracted field, classification, and gate decision traces to a specific rule. This matters for public-safety workflows where accountability requires knowing why a decision was made.

**What it validates:** A rule-based engine can extract structured incident data from semi-structured dispatch transcript text, detect conflicts, apply safety gates, and produce auditable output.

**What survives:** The processing contracts (input types, output types, gate semantics, conflict model) and the expectation that every inference is traceable.

**What changes for production:** Rules may be supplemented or replaced with ML-based extraction, but the contract that every inference carries a rationale must be preserved. The current single-agency dictionary and pattern set does not generalize without expansion.

---

## 3. ASR is provider-based

**Decision:** ASR is abstracted behind a provider registry. The application does not perform transcription — it consumes ASR results from a selected provider.

**Reasoning:** The transcription engine is replaceable and fallible. Different deployment contexts may use different ASR services (cloud, on-premise, on-device). The domain logic must not depend on any specific ASR implementation.

**What it validates:** The provider boundary works — mock providers, scenario-linked providers, and the experimental local Whisper adapter all produce results that flow through the same PENNY quality gate and review workflow.

**What survives:** The provider interface contract, the principle that ASR is a replaceable upstream dependency.

**What changes for production:** Mock providers are replaced with evaluated, authorized ASR services. The provider registry becomes configuration-driven with real health checks, failover, and SLA monitoring.

---

## 4. PENNY is separate from ASR

**Decision:** PENNY (Provenance Engine for Normalized Narrative Yield) sits between ASR output and incident processing as an independent trust boundary.

**Reasoning:** "Is this transcript trustworthy enough to influence incident state?" is a fundamentally different question from "What words were spoken?" The trust decision must live in one auditable place, independent of the ASR engine, so that changing the ASR provider does not change the governance model.

**What it validates:** Provider-agnostic transcript governance — quality evaluation, issue classification, human review, sign-off, and provenance tracking work identically regardless of which ASR provider produced the transcript.

**What survives:** The PENNY boundary concept, quality evaluation taxonomy, and the principle that no transcript touches incident state without governed human review.

**What changes for production:** PENNY may evolve from an in-process module to a governance service, but its core responsibility — quality-gating ASR output before it influences operational decisions — persists.

---

## 5. Human review and sign-off are enforced

**Decision:** Human review is enforced in domain logic, not just UI. Overriding a blocking issue without a note throws. Signing off before issues are resolved throws. These are code guards, not UI decorations.

**Reasoning:** In a public-safety context, "human-in-the-loop" must be a hard constraint. If the enforcement is only in the UI, a future refactor or API consumer could bypass it. Putting the guards in the domain engine means any caller — UI, API, or test — is subject to the same rules.

**What it validates:** The review workflow cannot be silently bypassed. Override requires documented justification. Sign-off requires all issues addressed.

**What survives:** The enforcement pattern — guards in the domain layer, not just the presentation layer.

**What changes for production:** The hardcoded reviewer identity (`"Dispatcher (you)"`) is replaced with authenticated identity. Review actions are persisted in a durable audit store, not an in-memory array.

---

## 6. Safety gates are domain rules

**Decision:** Safety gates (A through E) are defined and evaluated in the domain layer (`safetyGates.ts`). The same gate logic that the UI renders is the logic that blocks CAD submission.

**Reasoning:** If gate display and gate enforcement diverge, the UI could show "ready" while the engine blocks submission, or vice versa. Single-sourcing gates means the visible state always matches the enforced state.

**What it validates:** Gate conditions are consistent between display and enforcement. The UI cannot show a false "ready" state.

**What survives:** The gate contract pattern and the principle of single-sourced safety evaluation.

**What changes for production:** Gate definitions may expand (additional agency-specific or compliance gates). Evaluation inputs may include data from external systems. The single-source principle persists.

---

## 7. CAD is mocked

**Decision:** The CAD integration builds a payload object (`mockCad.ts`) but does not send it anywhere. The object is rendered as JSON in the UI for human review. Audit records log "NOT SENT."

**Reasoning:** A real CAD integration (One Solution) requires understanding write semantics, idempotency, acknowledgement models, and reconciliation — none of which can be designed without access to the target system. Rather than guess, the prototype demonstrates payload construction and sensitive-field redaction without transport.

**What it validates:** The payload shape, field redaction, and sensitive-data gating logic. The mock also validates that the audit correctly records the absence of real submission.

**What survives:** The payload construction and redaction logic (partially). The field mapping is a draft and will need validation against real CAD schemas.

**What changes for production:** Real transport with idempotency keys, retry, acknowledgement, and reconciliation. The payload schema is validated against One Solution's actual write contract.

---

## 8. Provenance is explicit

**Decision:** Every domain action generates an audit event with a correlation ID, timestamp, actor, and detail payload. Events are append-only by convention (not by enforcement).

**Reasoning:** Public-safety workflows require knowing who did what, when, and why. Building provenance into the prototype — even without durable storage — validates the audit schema and establishes the expectation that every action is traceable.

**What it validates:** The audit event model captures sufficient context for reconstruction. Correlation IDs link related events across the workflow.

**What survives:** The audit event schema, correlation model, and the principle that every domain action is auditable.

**What changes for production:** The in-memory array becomes an append-only durable store. Events are signed with real identity. Timestamps come from a trusted source. The client can no longer mutate audit state.

---

## 9. Canonical JSON and SHA-256

**Decision:** Audit exports use deterministic JSON serialization (`canonicalJson.ts`) and embed a SHA-256 hash for integrity verification.

**Reasoning:** If the same state always serializes to the same bytes, a hash becomes meaningful — re-hashing the export and comparing detects any modification. This is local tamper-evidence, not a cryptographic signature (there is no key).

**What it validates:** The deterministic serialization + hash pattern detects accidental or naive modification of exported audit data.

**What survives:** The canonical serialization approach and the principle of integrity verification.

**What changes for production:** Production would require a CentralSquare-approved identity-backed integrity mechanism, trusted timestamps, and durable or immutable audit storage. The current mechanism detects accidental changes; production must resist motivated adversaries.

---

## 10. Guided scenarios are deterministic

**Decision:** The guided demo uses four seeded scenarios with fixed transcript lines, synthetic names, and predictable outcomes. Scenarios are replayed through the same deterministic engine used in verification.

**Reasoning:** Deterministic scenarios make the system demonstrable and testable without real data. Every run produces identical results, which makes behavior inspectable and regressions detectable.

**What it validates:** The same engine that processes scenario data in the demo also processes it in the verification harness. If the demo works, the verification checks the same code paths.

**What survives:** The scenario-based testing pattern and the seed data format.

**What changes for production:** Scenarios remain useful for regression testing. Real data flows through the same domain logic but with real ASR, real identity, and durable state.

---

## 11. Verification targets domain logic

**Decision:** The `verify-mii.ts` harness tests domain functions directly — extraction, state machines, gates, audit, PENNY — without rendering UI or using a browser.

**Reasoning:** Domain correctness is the highest-value verification target. Testing it without UI dependencies makes the harness fast, deterministic, and portable. UI testing is valuable but lower priority for a prototype validating domain semantics.

**What it validates:** 108 checks confirm that the domain engine produces correct output for known inputs, handles failure paths, and enforces safety constraints.

**What survives:** The verification approach and the check inventory.

**What changes for production:** UI and integration tests are added. The domain harness continues to run as a fast regression gate.

---

## 12. Productionization preserves contracts, replaces runtime

**Decision:** The production path should preserve domain contracts (types, gate semantics, PENNY boundary, audit schema, provider abstraction) while replacing runtime implementation (localStorage, singleton store, mock providers, demo auth, browser-local execution).

**Reasoning:** The prototype's value is in the validated contracts and workflow — not in the browser-local runtime. Replacing the runtime with durable, distributed, authenticated infrastructure does not require rewriting domain logic if the contracts are preserved.

**What it validates:** The contracts are separable from the runtime. Domain modules have no browser or framework dependencies.

**What changes for production:** See `review-prep/05-production-evolution-map.md` for a staged perspective. The standing principle: identify what CentralSquare's platform already provides before building new services.
