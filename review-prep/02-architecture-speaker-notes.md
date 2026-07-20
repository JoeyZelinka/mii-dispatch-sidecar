# Architecture Speaker Notes — MII_lite

First-person notes Joey can speak naturally. Each subsystem: what it is, why it exists, the assumption it tested, why it's built this way, the strongest decision, the limitation to volunteer, what survives, what gets replaced, how it's tested, and what not to claim.

Keep the through-line: *sound concepts, honestly-labeled prototype.*

---

## Runtime execution
- **What it is:** A browser-local app. Next.js pages are thin shells; all real logic runs client-side. The only server code is a cookie gate and two demo-auth routes.
- **Why it exists:** "I wanted to prove the reasoning and the human workflow without committing to a platform. So I pushed everything to the client and kept the boundaries mock."
- **Assumption tested:** Can a deterministic, explainable dispatch-assist workflow be made concrete end-to-end by one engineer, fast?
- **Why this way:** "It let me iterate on domain logic without infrastructure in the way."
- **Strongest decision:** Domain logic is cleanly separated from delivery, so it can move to a real runtime later.
- **Limitation to volunteer:** "There's no service here. 'Server' means a cookie check."
- **Survives:** the domain/delivery separation.
- **Replaced:** the entire runtime and delivery layer.
- **Tested:** not at the runtime level — the harness tests the domain library only.
- **Do not claim:** that this is a deployable service or that it scales at runtime.

## State and persistence
- **What it is:** A single client store, `miiStore`, on `useSyncExternalStore` + `localStorage`. Every mutation clones the whole state, runs a pure function, persists, emits.
- **Why it exists:** "I needed predictable, single-writer state I could reason about and audit."
- **Assumption tested:** Can one deterministic state machine drive the whole workflow?
- **Why this way:** "structuredClone per mutation guarantees React sees fresh references and keeps mutations pure and easy to test."
- **Strongest decision:** Single-writer store with pure engine functions — one auditable transition per action.
- **Limitation to volunteer:** "It's single-session and in-memory. The clone cost grows with history, and a refresh loses the in-browser audio blob."
- **Survives:** the action API surface.
- **Replaced:** whole-state clone, localStorage, and the single-session assumption → server state + DB + sync.
- **Tested:** no — the harness re-implements a fresh state and never touches the store or persistence.
- **Do not claim:** that state is durable, shared, or multi-user.

## Incident-processing engine
- **What it is:** Deterministic transcript-to-incident logic — cue detection, field extraction, semantic classification, conflict handling.
- **Why it exists:** "For a safety context I wanted explainability and repeatability before anything model-based."
- **Assumption tested:** Can radio traffic be turned into structured incidents with a rationale for every decision?
- **Why this way:** "Regex and branch rules are transparent and repeatable. Every classification emits a plain-English rationale."
- **Strongest decision:** Explainability by construction — plus a material contradiction raises a conflict and blocks CAD until a human resolves it.
- **Limitation to volunteer:** "It's brittle, single-agency pattern matching tuned to seeded scenarios. It won't generalize as written."
- **Survives:** the semantic model, conflict-blocks-CAD, rationale-on-every-decision.
- **Replaced:** the regex extractor itself.
- **Tested:** yes — core scenario extraction, conflict detection, replay parity in the harness.
- **Do not claim:** that this is NLU or that it handles arbitrary real transcripts.

## ASR provider abstraction
- **What it is:** A capability-flagged provider registry with an adapter contract; UI and engine read the same registry.
- **Why it exists:** "I separated these because the transcription engine is replaceable and fallible, and I didn't want that choice bleeding into incident logic."
- **Assumption tested:** Can any ASR source plug in behind one result contract?
- **Why this way:** "Flags (`realAsr`, `experimental`, `requiresLocalModel`) keep the UI and processor from making inconsistent assumptions."
- **Strongest decision:** A real, typed extension seam rather than hardcoded provider checks.
- **Limitation to volunteer:** "The adapter is synchronous, and real ASR is async — the contract needs that change. And the one real provider currently bypasses the seam."
- **Survives:** the registry + capability-flag pattern.
- **Replaced:** the sync signature; the mock adapters.
- **Tested:** yes — registry metadata, provider dispatch, and failure providers.
- **Do not claim:** that mock ASR proves anything about transcription quality.

## Local Whisper
- **What it is:** Experimental in-browser Whisper-tiny via Transformers.js/WASM, no cloud, no upload.
- **Why it exists:** "To test whether on-device, offline transcription is feasible in this shape."
- **Assumption tested:** Can we transcribe locally without sending audio anywhere?
- **Why this way:** "CPU/WASM, strictly-local model loading, so no network dependency."
- **Strongest decision:** On-device concept with a handoff that still forces human review.
- **Limitation to volunteer:** "The model weights aren't in the repo, so it doesn't run as shipped, and my tests never invoke the real inference. It bypasses the async job machine, and since Whisper gives no field confidence I stamp a low placeholder to force review."
- **Survives:** the on-device concept and handoff-to-review pattern.
- **Replaced:** the bypass path, synthetic confidence, unproven model; needs a worker and real-audio evaluation.
- **Tested:** only the deterministic handoff with hand-supplied text — not the inference itself.
- **Do not claim:** that local Whisper has been validated on real authorized radio traffic.

## PENNY
- **What it is:** A provider-agnostic orchestration layer that quality-gates and normalizes any ASR output before it can influence an incident. Never does ASR, never creates incidents, never writes CAD.
- **Why it exists:** "I separated PENNY from ASR because ASR is a replaceable, fallible engine, and I wanted one place that governs whether any transcript is trustworthy enough to proceed — independent of how the words were produced."
- **Assumption tested:** Can a single review/quality/provenance boundary govern all ASR sources uniformly?
- **Why this way:** "It centralizes the trust decision and the sign-off, so the 'no transcript reaches CAD unreviewed' rule lives in one auditable place."
- **Strongest decision:** This is the strongest idea in the codebase — the review-before-incident trust boundary.
- **Limitation to volunteer:** "PENNY imports processor functions, so the module coupling isn't as clean as the boundary. I'd keep the contract and break the imports."
- **Survives:** the trust boundary and quality-issue model.
- **Replaced:** the processor coupling.
- **Tested:** yes — orchestration lifecycle, quality gate, review readiness.
- **Do not claim:** that PENNY is fully decoupled at the module level today.

## Transcript-quality evaluation
- **What it is:** PENNY's scoring of an ASR result into quality issues — low-confidence segments, empty/failed transcript, admin-chatter, sensitive content.
- **Why it exists:** "To turn raw ASR output into explicit, reviewable issues instead of a silent pass/fail."
- **Assumption tested:** Can transcript risk be surfaced as discrete, actionable items?
- **Why this way:** "Thresholds — below 0.55 blocks, below 0.8 warns — map directly to what a human must do."
- **Strongest decision:** Severity-tiered issues drive the human workflow deterministically.
- **Limitation to volunteer:** "The thresholds are fixed constants, and confidence for the mocks is fabricated — so this evaluates the *workflow*, not model calibration."
- **Survives:** the issue taxonomy and severity tiers.
- **Replaced:** fixed thresholds → calibrated, tenant/provider-aware policy.
- **Tested:** yes — including the empty-transcript-stays-blocked case.
- **Do not claim:** that these confidence numbers reflect real ASR calibration.

## Human review and sign-off
- **What it is:** Explicit review actions — acknowledge warnings, override blocking with a required note, sign off.
- **Why it exists:** "Human control had to be enforced in the engine, not just implied by the UI."
- **Assumption tested:** Can the human-in-the-loop be made non-bypassable and auditable?
- **Why this way:** "Override without a note throws. Sign-off before issues are resolved throws. The bad path is refused at the function level."
- **Strongest decision:** Hard guards in code, and sign-off recorded with a timestamp.
- **Limitation to volunteer:** "The reviewer identity is a hardcoded string, so attribution isn't real yet."
- **Survives:** the enforced-guard pattern and sign-off semantics.
- **Replaced:** identity — needs real authenticated users.
- **Tested:** yes — both throw-paths are asserted.
- **Do not claim:** that sign-off is currently attributable to a real person, or that review can be safely bypassed.

## Incident processing
- **What it is:** Turning an attached, reviewed transcript into an incident with fields, recommendations, and a review snapshot.
- **Why it exists:** "To connect the reviewed transcript to the existing deterministic engine as a distinct human step."
- **Assumption tested:** Can attachment and processing stay separate, human-driven stages?
- **Why this way:** "Processing reuses the same per-line engine as scenarios and replay, so there's one code path."
- **Strongest decision:** One processing path shared across scenario, replay, and audio-attachment.
- **Limitation to volunteer:** "It's coupled to the mutable state draft — it's not an isolated service."
- **Survives:** the shared processing path and review-snapshot linkage.
- **Replaced:** the mutable-draft coupling.
- **Tested:** yes — attachment-to-incident, snapshot capture.
- **Do not claim:** that processing is an independent service today.

## Safety gates
- **What it is:** Gates A–E (ASR confirmed, required unit, core fields, sensitive-field policy, conflict state) plus combined readiness folding in review and policy gates.
- **Why it exists:** "So the visible gates and the actual submit-blocking logic can never diverge."
- **Assumption tested:** Can pre-CAD safety be made explicit and single-sourced?
- **Why this way:** "One function feeds both the chips and the disabled Submit button."
- **Strongest decision:** Shared source of truth; explicit blocking-vs-warning distinction.
- **Limitation to volunteer:** "The rules are hardcoded — auditable, but not yet tenant-configurable."
- **Survives:** the gate contract and shared-source pattern.
- **Replaced:** hardcoded rules → tenant-scoped configuration.
- **Tested:** yes — block/clear behavior and warning-not-blocking.
- **Do not claim:** that gate rules are configurable per agency today.

## Sign-off policy
- **What it is:** A configurable governance setting — not-required, advisory, required-for-PENNY, required-for-all-audio — evaluated as a pure gate.
- **Why it exists:** "To show governance can be policy-as-data, not code changes."
- **Assumption tested:** Can the sign-off requirement be a setting rather than a branch?
- **Why this way:** "An enum plus a pure evaluator keeps it declarative."
- **Strongest decision:** Policy-as-data with a clean gate result.
- **Limitation to volunteer:** "It's a single global policy — no tenant scoping."
- **Survives:** the mode enum and gate contract.
- **Replaced:** global policy → per-tenant policy store.
- **Tested:** yes — all modes, including BLOCKED and ADVISORY.
- **Do not claim:** that policy is multi-tenant today.

## Mock CAD
- **What it is:** A local payload builder with sensitive-field redaction. Stored in memory, audited as "NOT SENT."
- **Why it exists:** "To model the CAD hand-off and the redaction rules without touching a real system."
- **Assumption tested:** What does a defensible CAD payload look like, and what must be gated out?
- **Why this way:** "Building the object made the field and redaction decisions concrete."
- **Strongest decision:** Redaction of unconfirmed sensitive fields is enforced in the payload.
- **Limitation to volunteer:** "There's no client, no transport, no idempotency, no retry, no reconciliation. It's a JSON builder."
- **Survives:** the payload field shape as a draft schema.
- **Replaced:** everything — a real adapter with idempotency/retry/reconciliation.
- **Tested:** yes — redaction and inclusion behavior.
- **Do not claim:** that there is any live One Solution / CentralSquare CAD integration.

## Audit and correlation
- **What it is:** Append-by-convention audit events with correlation IDs threading each run; grouped by plan/job.
- **Why it exists:** "To make every meaningful action reconstructable."
- **Assumption tested:** Can a full provenance chain be assembled from discrete events?
- **Why this way:** "Correlation IDs threaded by parameter keep a run's events together."
- **Strongest decision:** The event schema and correlation model.
- **Limitation to volunteer:** "It's a client-mutable array — append-only is a convention, not enforced."
- **Survives:** event schema and correlation concept.
- **Replaced:** the in-memory sink → real append-only store.
- **Tested:** indirectly — via export content and correlation grouping.
- **Do not claim:** that the audit log is immutable or a defensible legal record.

## Audit export integrity
- **What it is:** Canonical JSON + SHA-256 self-embedded hash, with a recompute-and-compare verifier (VALID / MODIFIED / INVALID_FORMAT).
- **Why it exists:** "To detect accidental modification of an exported provenance file."
- **Assumption tested:** Can we make an export tamper-*evident* locally and offline?
- **Why this way:** "Deterministic canonicalization plus a keyless digest is enough to catch corruption."
- **Strongest decision:** Deterministic canonicalization and an honest, self-contained verify flow.
- **Limitation to volunteer:** "It is not a signature. No key, public algorithm — anyone could edit the file and recompute the hash. It's tamper-evidence, not chain of custody."
- **Survives:** the canonicalization and verify-flow shape.
- **Replaced:** keyless hash → keyed signature/HMAC + trusted timestamp + external anchoring.
- **Tested:** yes — mutate-then-reverify, missing integrity, bad format.
- **Do not claim:** that the export is cryptographically signed or provides legal chain of custody.

## Verification harness
- **What it is:** A hand-rolled 108-check runner over the domain library. No framework, no React/store/persistence, no real ASR.
- **Why it exists:** "To lock in the domain behavior as a fast regression guard while I iterated."
- **Assumption tested:** Does the deterministic logic — including failure and override paths — behave as designed?
- **Why this way:** "A tiny custom runner was faster to stand up than wiring a framework, and the logic is pure so it's easy to drive directly."
- **Strongest decision:** Real coverage of failure, override, and tamper paths, not just happy paths.
- **Limitation to volunteer:** "It's a domain smoke test, not end-to-end. No UI, store, persistence, real Whisper, or concurrency. And it re-implements fresh state, so there's drift risk with the real store."
- **Survives:** the harness as a starting spec.
- **Replaced:** needs a real framework plus UI/store/integration/e2e and real-ASR tests.
- **Do not claim:** that "108 passed" means end-to-end correctness.

## Scalability
- **What it is:** Two separate questions — conceptual vs runtime.
- **Say it plainly:** "Conceptually, the domain model, the ASR seam, the PENNY boundary, the gate and policy contracts, and the audit schema hold up and I'd carry them forward. At runtime it does not scale — single browser, in-memory, whole-state clone, no server, no queue, no worker, no tenant isolation. The first thing that breaks under load is the main thread and the growing clone cost within a session, and none of the runtime pieces get tuned — they get replaced."
- **Do not claim:** any capacity, channel count, or concurrency number.

## Multi-tenancy
- **What it is:** Tenant and agency exist as *fields* on the incident, but they're hardcoded constants; one global policy and single-agency dictionaries.
- **Say it plainly:** "The concept of tenancy is in the schema, which is useful, but there's no isolation. Everything assumes one agency. A second agency needs tenant context on every operation, per-tenant config, and isolated storage."
- **Survives:** the tenant/agency fields as a schema seed.
- **Replaced:** everything that treats tenant as a constant.
- **Do not claim:** that the application is multi-tenant.

## Production evolution
- **What it is:** A staged path from prototype to production (see `05-production-evolution-map.md`).
- **Say it plainly:** "I'd harden the domain contracts, pull orchestration out of the UI, put durable workflow state behind it, move heavy work to workers, add tenant-aware config, then integrate real audio, real ASR evaluation, a real CAD adapter, real identity/security/audit, and finally observability and load/failure testing. At several of those stages the right first move is to check what CentralSquare already provides rather than build it."
- **Do not claim:** that this prototype is the proposed Project Echo production architecture.
