# Reviewer Question Bank — MII_lite

Adversarial-but-fair questions per reviewer. Each entry: **why they ask**, **strongest honest answer**, **dangerous answer to avoid**, **useful follow-up Joey can ask them**.

Ground rule for every answer: separate *concept* from *implementation*, and never overstate. If unsure, say "the code doesn't establish that" rather than guessing.

---

## Thomas — AI and Model Review

### 1. How does ASR provider selection actually work?
- **Why:** Wants to know if it's a real abstraction or hardcoded.
- **Strongest answer:** "There's a capability-flagged registry in `providerRegistry.ts`. The UI and the job processor both read it, so they agree on what each provider is — mock, stub, or real. Provider choice is a plan field; the engine dispatches on it."
- **Avoid:** "It just picks Whisper." (It doesn't; the real path bypasses the dispatch.)
- **Follow-up:** "In production, would you expect provider selection to be per-tenant policy or per-incident routing?"

### 2. What's real ASR versus mocked?
- **Strongest answer:** "Two deterministic mocks, two inert stubs, one experimental real local Whisper. The mocks exist to exercise the workflow deterministically. Only Whisper does real inference, and it's experimental."
- **Avoid:** implying the mocks demonstrate transcription quality.
- **Follow-up:** "What's your bar for calling an ASR path 'validated' — WER, or field-level operational accuracy?"

### 3. What are the limitations of the local Whisper path?
- **Strongest answer:** "It's Whisper-tiny in WASM. The weights aren't in the repo, so it doesn't run as shipped; my tests never invoke the real inference; it runs on the main thread; and it bypasses the async job abstraction. It proves feasibility of on-device transcription, nothing about accuracy."
- **Avoid:** "It works well." (Untested on real audio.)
- **Follow-up:** "For offline/edge scenarios, is on-device ASR something CentralSquare wants, or is cloud ASR the assumption?"

### 4. How is confidence calibrated?
- **Strongest answer:** "It isn't. For mocks, confidence is fabricated deterministically from line content. For Whisper, there's no field-level confidence, so I stamp a low placeholder to force review. So confidence drives the *workflow*, not a calibrated risk estimate."
- **Avoid:** presenting any confidence number as meaningful accuracy.
- **Follow-up:** "What calibration methodology would you want before confidence gates a real write?"

### 5. Why synthetic confidence values at all?
- **Strongest answer:** "To make the review workflow deterministic and testable — I needed predictable inputs to prove the gate behavior. Real confidence replaces them without changing the gate contract."
- **Avoid:** defending them as realistic.
- **Follow-up:** "Would you want confidence per field, per segment, or both, feeding the gates?"

### 6. Why is there no field-level confidence from Whisper?
- **Strongest answer:** "Transformers.js Whisper doesn't expose it in this setup. That's exactly why the handoff assigns a conservative placeholder that trips PENNY's warning tier — so unknown confidence defaults to human review, not silent acceptance."
- **Avoid:** claiming you can derive reliable per-field confidence today.
- **Follow-up:** "Is field-level confidence a hard requirement, or is segment-level plus human review acceptable?"

### 7. What's your evaluation methodology?
- **Strongest answer:** "For the deterministic engine, a 108-check regression harness including failure and override paths. For ASR, there is none yet — no real-audio corpus, no WER, no field-accuracy measurement. That's a named gap in my evolution plan."
- **Avoid:** implying the harness evaluates ASR.
- **Follow-up:** "Do we have labeled authorized radio traffic we could build an eval set from?"

### 8. WER versus operational field accuracy — which matters here?
- **Strongest answer:** "Operational field accuracy is what actually matters — whether nature, address, and unit come out right — because that's what drives the incident. WER is a proxy. I'd measure both but gate on field-level accuracy."
- **Avoid:** treating WER as sufficient.
- **Follow-up:** "How do you weigh a low-WER transcript that still gets the address wrong?"

### 9. Deterministic versus model-based logic — why deterministic?
- **Strongest answer:** "For a safety context I wanted explainability and repeatability first. Every classification emits a rationale. It's brittle and single-agency, but it's transparent and auditable — a deliberate starting point, not a claim that rules beat models."
- **Avoid:** "Rules are enough." (They won't generalize.)
- **Follow-up:** "Where do you see the first place a model should replace a rule — extraction, or classification?"

### 10. Why is PENNY separate from ASR?
- **Strongest answer:** "Because ASR is a replaceable, fallible engine, and the trust decision — is this transcript good enough to touch an incident — has to be governed in one place independent of which engine produced the words. PENNY is that boundary: it quality-gates, normalizes, and requires sign-off, and it can't create incidents or write CAD."
- **Avoid:** describing PENNY as an ASR component.
- **Follow-up:** "Would you keep review provider-agnostic, or specialize it per ASR engine?"

### 11. How does human review actually constrain the system?
- **Strongest answer:** "In code, not just UI. Overriding a blocking issue without a note throws; signing off before issues are resolved throws. So the unsafe path is refused at the function level."
- **Avoid:** "The UI prevents it." (Weaker; the engine enforces it.)
- **Follow-up:** "What review evidence would you want retained per decision for responsible-AI review?"

### 12. How is provenance preserved?
- **Strongest answer:** "Source line IDs thread into extracted fields and cue events; confirmations append provenance rather than overwrite; correlation IDs group a run; the export bundles the whole chain. What's lost: the audio blob on refresh, and real speaker/confidence on the Whisper path."
- **Avoid:** claiming full provenance including audio.
- **Follow-up:** "Is audio retention part of provenance for your responsible-AI standard?"

### 13. How would you handle model versioning?
- **Strongest answer:** "It's not handled yet — the model ID is a constant. In production the model version and canonicalization version belong in the provenance record so any transcript is traceable to the exact model that produced it."
- **Avoid:** implying versioning exists.
- **Follow-up:** "Do you version models at the provider or the tenant level?"

### 14. How do you prevent false writes to CAD?
- **Strongest answer:** "Layered gates plus human sign-off. A material contradiction forces a CONFLICT state that blocks submission; blocking quality issues require an overridden note; core-field and conflict gates block the Submit button; and CAD itself is mock — nothing leaves. The concept is defense-in-depth before any external write."
- **Avoid:** "The gates guarantee correctness." (They reduce risk; a human decides.)
- **Follow-up:** "What's your tolerance for false-block versus false-write in this domain?"

### 15. Is this responsible-AI-defensible?
- **Strongest answer:** "The structure is — deterministic and explainable, human-in-the-loop enforced, provenance threaded, nothing auto-writes externally. What's missing for a real bar: real identity on sign-off, ASR evaluation, model versioning, and a real audit store. I can name every gap."
- **Avoid:** claiming it meets a compliance bar.
- **Follow-up:** "What's the minimum responsible-AI checklist you'd hold Project Echo to?"

---

## Brian — Software Engineering Review

### 1. Walk me through `AudioClient`. Isn't this a god component?
- **Strongest answer:** "It is, and it's my first refactor target. 1475 lines, ~24 state hooks, 31 store calls, eight workflows. The sequencing lives in the UI. I'd pull it into per-workflow hooks or a controller/service layer."
- **Avoid:** defending it as fine.
- **Follow-up:** "Do you prefer per-workflow hooks or a dedicated orchestration layer for this?"

### 2. `processor.ts` is 1424 lines and owns the state type. Concern?
- **Strongest answer:** "Yes — it owns `MiiState` and most engine logic, and other modules import the state type from it. I'd split incident lifecycle, ASR job machine, and audio intake, and lift `MiiState` to its own module."
- **Avoid:** "It's cohesive so size is fine."
- **Follow-up:** "Would you split by lifecycle stage or by aggregate?"

### 3. Module size generally — is this maintainable?
- **Strongest answer:** "The domain library is well-separated by responsibility; the two problem files are `AudioClient` and `processor`. The rest is small and focused. Size is concentrated, not pervasive."
- **Avoid:** hand-waving the two big files.
- **Follow-up:** "What line-count or complexity threshold do you enforce on the team?"

### 4. PENNY imports processor functions — that coupling worries me.
- **Strongest answer:** "Agreed. The trust *boundary* is enforced, but the module *dependency* isn't clean — PENNY calls processor's job/attach functions. I'd keep the contract and invert or extract those so PENNY depends on an interface, not the implementation."
- **Avoid:** claiming they're decoupled.
- **Follow-up:** "Would you introduce an ASR-job interface, or an event/command bus between them?"

### 5. Every mutation clones the entire state. Really?
- **Strongest answer:** "Yes — `structuredClone` per action. It keeps mutations pure and React refs fresh, which was great for correctness and testing. It's O(total state) and grows with history, so it's a known runtime cost I'd replace with a real store."
- **Avoid:** defending it as performant.
- **Follow-up:** "Immutable structural sharing, or a server-backed store — where would you take it first?"

### 6. What's the actual test scope?
- **Strongest answer:** "108 checks over the pure domain library — extraction, ASR job and PENNY state machines, gates, tamper-evidence, including failure and override paths. No UI, store, persistence, real Whisper, or concurrency. It's a domain regression guard, not end-to-end."
- **Avoid:** "It's well tested" without the caveat.
- **Follow-up:** "Would you prioritize store/persistence tests or an e2e harness first?"

### 7. No UI or store tests — how do you trust the app?
- **Strongest answer:** "I don't trust the app end-to-end from tests today — only the domain logic. The store and UI are verified manually. That's a real gap; a real framework plus store and e2e tests are on the plan."
- **Avoid:** implying manual testing is sufficient.
- **Follow-up:** "What's your minimum bar for merge — unit, integration, or e2e coverage?"

### 8. Where's runtime validation of inputs and persisted state?
- **Strongest answer:** "There isn't any — types are compile-time only, and hydrated localStorage is cast, not validated. There's an `incident as IncidentContext` cast in the export too. I'd add schema validation at the persistence and import boundaries."
- **Avoid:** "TypeScript covers it." (It doesn't at runtime.)
- **Follow-up:** "Zod-style schemas at the boundary, or a validation layer in the store?"

### 9. How's error handling?
- **Strongest answer:** "Deterministic guards throw where a human path is required — override-without-note, premature sign-off. The verifier never throws; it returns a status. But there's no broad error strategy for I/O, model load, or corrupt state beyond fall-back-to-fresh."
- **Avoid:** claiming comprehensive error handling.
- **Follow-up:** "Do you standardize on Result types or exceptions across services?"

### 10. Idempotency — where is it?
- **Strongest answer:** "Nowhere for CAD — re-submit overwrites with a new timestamp, no idempotency key. Conflict re-hearing and confirmations are de-duplicated in the engine, but external writes have no idempotency yet. That's a required addition for a real CAD adapter."
- **Avoid:** implying writes are safe to retry today.
- **Follow-up:** "Does One Solution support client-supplied idempotency keys, or do we dedupe on our side?"

### 11. Interfaces versus conceptual seams — which are real?
- **Strongest answer:** "Real typed interfaces: the ASR provider registry/adapter and the policy/gate results. Conceptual only: AudioSourceAdapter, the CAD adapter, and an AuditSink — those are named in intent but there's no interface. I wouldn't claim more than exists."
- **Avoid:** calling the CAD builder an 'adapter.'
- **Follow-up:** "Which seam would you want formalized first?"

### 12. What's the real technical debt here?
- **Strongest answer:** "Top items: `AudioClient` orchestration, `processor` size, PENNY/processor coupling, no runtime validation, no UI/store tests, whole-state clone, and unauthenticated identity. I have them ranked with dispositions — preserve, refactor, replace, validate, or defer."
- **Avoid:** minimizing.
- **Follow-up:** "Do you want debt tracked as tickets against the evolution stages?"

### 13. What's the refactor order?
- **Strongest answer:** "Harden domain contracts, extract orchestration from the UI, add durable workflow state, then move heavy work to workers. UI and processor decomposition come early because they unblock everything else."
- **Avoid:** starting with features.
- **Follow-up:** "Would you sequence contract-hardening before or after the UI extraction?"

### 14. What code is genuinely reusable?
- **Strongest answer:** "The domain types, the ASR registry/adapter pattern, the PENNY trust boundary, the gate and policy contracts, the audit event/correlation schema, and the harness as a spec. Those are the durable assets."
- **Avoid:** claiming the store or UI is reusable as-is.
- **Follow-up:** "Would you extract the domain library into its own package early?"

### 15. What should be rewritten, not refactored?
- **Strongest answer:** "The store's persistence, the UI orchestration role, the mock adapters, the keyless verification, and demo auth. Those get replaced behind stable contracts, not incrementally patched."
- **Avoid:** implying everything can be salvaged incrementally.
- **Follow-up:** "Rewrite behind the existing contracts, or redesign the contracts too?"

---

## Ray — Platform and Scalability Review

### 1. Does this scale at runtime?
- **Strongest answer:** "No, and I won't claim it does. It's a single-browser, in-memory, single-session prototype. The concepts scale; the runtime doesn't — each piece gets replaced, not tuned."
- **Avoid:** any capacity or concurrency number.
- **Follow-up:** "What's the target concurrency and channel volume we're actually designing for?"

### 2. Why is execution browser-local?
- **Strongest answer:** "To iterate on domain logic without infrastructure. It's deliberate for a prototype. Production moves processing to server/worker tiers behind the same action API."
- **Avoid:** defending browser execution as a production choice.
- **Follow-up:** "Do you want processing server-side, edge, or a hybrid for offline sites?"

### 3. Whole-state cloning per mutation — at scale?
- **Strongest answer:** "It's O(total state) and grows with session history. Fine for a demo, wrong for production. Replaced by a real store with structural sharing or server-side state."
- **Avoid:** "It's fast enough."
- **Follow-up:** "Do you standardize on a particular state/persistence platform I should target?"

### 4. localStorage as the store — really?
- **Strongest answer:** "Yes, single-origin, single-session, and a refresh even loses the in-memory audio blob. It's the clearest thing to replace with durable server state and a database."
- **Avoid:** implying it's durable.
- **Follow-up:** "What's our system of record for incidents and audit expected to be?"

### 5. How would multi-user state work?
- **Strongest answer:** "It doesn't today — two dispatchers can't share an incident, two tabs diverge. Production needs server-authoritative state with real-time sync and conflict handling."
- **Avoid:** claiming any multi-user capability.
- **Follow-up:** "Is there an existing CentralSquare real-time/eventing service I should build on rather than roll my own?"

### 6. Multi-tenancy?
- **Strongest answer:** "Tenant and agency are schema fields but hardcoded constants; one global policy; single-agency dictionaries. Concept present, isolation absent. Needs tenant context on every operation and isolated config/storage."
- **Avoid:** "It's multi-tenant."
- **Follow-up:** "Does CentralSquare have a tenancy service I should check before designing this?"

### 7. Where are the queues?
- **Strongest answer:** "There are none. The 'async ASR job' is a synchronous, one-step-per-call state machine — it *models* the lifecycle but isn't distributed. Real async work needs a queue and workers."
- **Avoid:** calling the job machine 'true async.'
- **Follow-up:** "Is there a platform message bus/queue standard I should target?"

### 8. Workers for heavy processing?
- **Strongest answer:** "None yet — even local Whisper runs on the main thread and blocks. Heavy work moves to server-side workers or, for on-device, a web worker."
- **Avoid:** implying processing is off the critical path.
- **Follow-up:** "For offline sites, do you want on-device workers or a local server tier?"

### 9. Persistence and system of record?
- **Strongest answer:** "localStorage only. No durable persistence, no system of record. That's a foundational replacement, not an add-on."
- **Avoid:** implying anything is persisted server-side.
- **Follow-up:** "What's the source of truth CAD and audit must reconcile against?"

### 10. Retries and dead-letter handling?
- **Strongest answer:** "Neither exists — no retries, no DLQ, no reconciliation, no idempotency on writes. All required for a real CAD path and part of the plan."
- **Avoid:** implying writes are reliable.
- **Follow-up:** "Do you have platform patterns for retry/DLQ I should adopt?"

### 11. Replay?
- **Strongest answer:** "There's a *scenario* replay for the demo that re-drives the deterministic engine — it proves determinism, not event-sourced recovery. Production replay would be event-log-based against a durable store."
- **Avoid:** conflating demo replay with operational replay.
- **Follow-up:** "Do you want event sourcing as the audit/replay foundation?"

### 12. Deployment topology?
- **Strongest answer:** "Undefined by the code — today it's a static client with a Netlify config. Production topology is an open question I'd design with you: where ASR runs, where state lives, offline requirements."
- **Avoid:** proposing a topology as if decided.
- **Follow-up:** "What deployment constraints — cloud region, on-prem, offline — should drive this?"

### 13. How does ASR scale?
- **Strongest answer:** "Not addressed. Local Whisper is per-browser and unproven. Production ASR scaling — cloud fleet or on-device pool — is a decision tied to the offline and latency requirements, not something this repo answers."
- **Avoid:** implying a scaling story exists.
- **Follow-up:** "Is on-device ASR a hard requirement, or is cloud ASR acceptable with connectivity?"

### 14. Tenant isolation for data and config?
- **Strongest answer:** "None today. Needs tenant-scoped storage, config, and policy, with tenant context propagated through every layer — including audit and CAD payloads."
- **Avoid:** claiming any isolation.
- **Follow-up:** "Should isolation be per-database, per-schema, or row-level in the platform standard?"

### 15. CAD integration reality?
- **Strongest answer:** "There is no live One Solution integration — it's a local JSON builder that audits 'NOT SENT.' The field shape is a draft. A real adapter needs transport, auth, idempotency, retry, and reconciliation, and I'd check One Solution's actual API semantics first."
- **Avoid:** any implication of a live integration.
- **Follow-up:** "What are One Solution's write semantics — idempotency keys, ack model, reconciliation?"

### 16. Observability?
- **Strongest answer:** "None — no metrics, tracing, or centralized logging. The audit log is domain provenance, not operational telemetry. Observability is a late but explicit stage in the plan."
- **Avoid:** presenting audit as observability.
- **Follow-up:** "What's the platform observability stack I should instrument against?"

### 17. Reliability and failure handling?
- **Strongest answer:** "The domain handles deterministic failure paths — failed ASR, blocked gates, corrupt state falls back to fresh. There's no infrastructure reliability story: no redundancy, retries, or health checks. That's platform work."
- **Avoid:** overstating reliability.
- **Follow-up:** "What SLOs would Project Echo carry?"

### 18. Security posture?
- **Strongest answer:** "Demo-grade: a single shared static token with hardcoded fallbacks gates most routes, and the audio route isn't even in the matcher. It's not access control. Production needs real authN/authZ tied to sign-off identity."
- **Avoid:** calling demo auth 'security.'
- **Follow-up:** "Is there a platform identity provider I should integrate rather than build auth?"

### 19. Data retention?
- **Strongest answer:** "Undefined — transcripts, audio, and audit live in localStorage with no retention policy. Retention and disposal rules are a requirement I need from the domain, not something to invent."
- **Avoid:** guessing retention rules.
- **Follow-up:** "What are the legal retention requirements for transcripts, audio, and audit?"

### 20. Which responsibilities belong to a platform service versus this app?
- **Strongest answer:** "Tenancy, identity, eventing/queues, durable state, audit anchoring, and observability are platform concerns I'd rather consume than rebuild. Before designing any of them I'd check what CentralSquare already provides."
- **Avoid:** assuming CentralSquare lacks these services.
- **Follow-up:** "Which of these does CentralSquare already own that I should build against?"
