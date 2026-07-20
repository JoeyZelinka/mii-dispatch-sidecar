# Live Code Walkthrough — MII_lite

**Audience:** Thomas (Head of AI), Brian Kronengold (VP Software Dev & AI), Ray Kaminski (Interim CTO / Cloud / Enterprise Tech Strategy)
**Target time:** 20–30 minutes if run fully.
**Framing to open with:** "This is a local reasoning and workflow prototype. It is deliberately deterministic, browser-local, and mock at every external boundary. I'll show what's real, what's mocked, what's experimental, and what I'd keep versus replace."

**Do not** claim production-readiness or runtime scalability at any stop. The story is: *sound domain concepts, honestly-labeled prototype implementation.*

Legend:
- **MUST SHOW** — core to the story; open the file live.
- **SHOW IF ASKED** — have it ready, don't spend time unprompted.
- **DO NOT WASTE TIME** — mention verbally, don't open.

---

## Stop 1 — Application purpose & execution boundary  · MUST SHOW
- **File:** [src/app/Providers.tsx](../src/app/Providers.tsx) (~L1–20), plus mention [src/proxy.ts](../src/proxy.ts) and [src/app/page.tsx](../src/app/page.tsx)
- **Symbols:** `Providers`, comment "no data fetching layer is needed here"
- **Why show it:** establishes that essentially all logic runs in the browser; pages are thin server shells.
- **Architectural point:** the execution boundary is the client. The only server code is a cookie gate and two demo-auth routes.
- **Say aloud:** "Everything meaningful runs client-side. The Next.js pages are near-empty shells that immediately hand off to client components. There's no backend, no database, no external API in this repo. That's intentional — the point was to prove the domain reasoning and the human-in-the-loop workflow, not to build the platform. So when you see 'server,' it's a cookie gate, nothing more."
- **Likely criticism:** "So none of this is a real service."
- **Honest response:** "Correct — by design. The service boundary is exactly what I'd expect us to build against CentralSquare platform services, not something I reinvented here."
- **Survives:** the separation of domain logic from delivery.
- **Replaced:** the entire delivery/runtime layer.
- **Who cares most:** Ray (all three will note it).

## Stop 2 — Domain ontology  · MUST SHOW
- **File:** [src/lib/mii/types.ts](../src/lib/mii/types.ts) (~L75–189 incidents/CAD, L295–378 ASR, L386–516 PENNY)
- **Symbols:** `IncidentContext`, `SuggestedField`, `AsrJob`, `PennyTranscriptionPlan`, `PennyReviewState`, `AuditEvent`, `MockCadPayload`
- **Why show it:** the vocabulary is explicit and carries the whole design.
- **Architectural point:** the domain is modeled first-class — incidents, ASR jobs, transcript packages, review state, gates, audit, sessions.
- **Say aloud:** "Before any UI, I modeled the domain explicitly. Everything downstream is typed against this. This is the part I'd carry into production almost unchanged — the concepts are stable even though the implementation around them isn't."
- **Likely criticism:** "The 'Phase 2A/3B' naming leaks your build history into the model."
- **Honest response:** "Fair — that's cosmetic naming from incremental development. The types themselves are clean; I'd rename on the way to production."
- **Survives:** the type vocabulary.
- **Replaced:** nothing structural; naming cleanup only.
- **Who cares most:** all three.

## Stop 3 — Deterministic incident-processing engine  · MUST SHOW
- **File:** [src/lib/mii/processor.ts](../src/lib/mii/processor.ts) — focus `processTranscriptLine` (~L366–434), `createOrUpdateIncident` (~L169–276), `maybeRaiseConflict` (~L129–165)
- **Supporting (SHOW IF ASKED):** [src/lib/mii/extractor.ts](../src/lib/mii/extractor.ts), [src/lib/mii/cueDetector.ts](../src/lib/mii/cueDetector.ts), [src/lib/mii/semanticClassifier.ts](../src/lib/mii/semanticClassifier.ts)
- **Symbols:** `processTranscriptLine`, `classifyLine`, `detectCues`, `extractFields`, `NEW_EVENT/UPDATE/CONFIRMATION/ADMIN_CHATTER`
- **Why show it:** this is the "reasoning," and it's regex + rules, not an LLM.
- **Architectural point:** deterministic, explainable classification; every inference carries a `rationale` string; conflicts block downstream writes.
- **Say aloud:** "This is where a transcript becomes an incident. It's fully deterministic — regexes and branch logic — and every decision produces a plain-English rationale. That was deliberate: for a dispatch safety context I wanted explainability and repeatability first. A contradiction on a material field raises a conflict and blocks CAD until a human resolves it."
- **Likely criticism:** "This won't generalize past your seeded scenarios."
- **Honest response:** "Right. It's brittle single-agency pattern matching — good enough to prove the workflow and the explainability model, not a production extractor. The seam is real; the implementation behind it would change."
- **Survives:** the semantic model, conflict-blocks-CAD rule, rationale-on-every-decision.
- **Replaced:** the regex extraction itself.
- **Who cares most:** Thomas (Brian on structure).

## Stop 4 — ASR provider model  · MUST SHOW
- **File:** [src/lib/mii/asr/providerRegistry.ts](../src/lib/mii/asr/providerRegistry.ts) (~L8–91); dispatch in [src/lib/mii/processor.ts](../src/lib/mii/processor.ts) `produceAsrResultForJob` (~L1241–1263)
- **Symbols:** `AsrProviderDefinition`, `ASR_PROVIDER_REGISTRY`, `getAsrProviderDefinition`, `realAsr`/`experimental`/`requiresLocalModel` flags
- **Why show it:** this is a genuine, typed extension seam.
- **Architectural point:** providers are described by capability flags; the UI and the job processor read the same registry.
- **Say aloud:** "ASR is behind a registry. Two providers are deterministic mocks, two are inert stubs, one is experimental real local Whisper. The capability flags keep the UI and the engine honest about what each provider actually is. This is the seam I'd keep — though the adapter signature is currently synchronous and real ASR is async, so the contract needs that change."
- **Likely criticism:** "Your mocks fabricate transcripts — this proves nothing about ASR."
- **Honest response:** "The mocks exist to exercise the *workflow* deterministically, not to prove transcription. The real-ASR question is separate and I'll show it next."
- **Survives:** the registry + capability-flag pattern.
- **Replaced:** sync `transcribe()` signature; mock adapters.
- **Who cares most:** Thomas and Brian.

## Stop 5 — Experimental local Whisper path  · MUST SHOW
- **File:** [src/lib/mii/asr/localOfflineWhisperAdapter.ts](../src/lib/mii/asr/localOfflineWhisperAdapter.ts) (~L31–100); handoff [src/lib/mii/asr/localOfflineHandoff.ts](../src/lib/mii/asr/localOfflineHandoff.ts) (~L112–173); model constants [localOfflineAsrAssets.ts](../src/lib/mii/asr/localOfflineAsrAssets.ts) (~L10–12)
- **Symbols:** `runLocalOfflineWhisperAsr`, `Xenova/whisper-tiny.en`, `completeLocalOfflineAsrForPlan`, `CONFIDENCE_WHEN_UNKNOWN = 0.7`
- **Why show it:** it's the one *real* inference path, and it's honestly experimental.
- **Architectural point:** genuine in-browser WASM Whisper, no cloud — but unproven, model weights not in the repo, and it bypasses the ASR job state machine.
- **Say aloud:** "This actually runs Whisper-tiny in the browser via WASM, no cloud, no upload. Two honest caveats: the model weights aren't in the repo — `public/models` is empty — so it doesn't run as shipped, and it's never exercised by my tests. It also bypasses the async job abstraction and injects results through a handoff. It's a proof of the offline concept, not a validated ASR capability. Since Whisper gives no field-level confidence, I stamp a low placeholder so PENNY forces human review."
- **Likely criticism:** "You're calling this 'real ASR' but it's untested and can't even run."
- **Honest response:** "I label it experimental in the UI and I won't overstate it. It shows on-device transcription is feasible in this shape; it does not show accuracy on real radio traffic."
- **Survives:** the on-device concept and the handoff-to-review pattern.
- **Replaced:** the bypass path, the synthetic confidence, unproven model choice; needs a worker + real-audio evaluation.
- **Who cares most:** Thomas (Ray on where it runs).

## Stop 6 — PENNY trust boundary  · MUST SHOW
- **File:** [src/lib/mii/penny.ts](../src/lib/mii/penny.ts) — header (~L29–35), `evaluateAsrResultForPenny` (~L250–388)
- **Symbols:** `createPennyPlan`, `evaluateAsrResultForPenny`, `PennyTranscriptPackage`, `TranscriptQualityIssue`, thresholds `0.55` blocking / `0.8` warning
- **Why show it:** this is the strongest idea in the codebase.
- **Architectural point:** PENNY is a provider-agnostic layer that quality-gates and normalizes any ASR output *before* it can influence an incident. It never does ASR, never creates incidents, never writes CAD.
- **Say aloud:** "PENNY is the reason ASR and incident logic are separable. It takes any transcript — mock or Whisper — quality-gates it, flags low-confidence segments, and prepares a reviewed package. It explicitly can't create incidents or write CAD. That's the trust boundary: no words reach an incident without passing through here."
- **Likely criticism:** "PENNY imports processor functions — it's not actually decoupled."
- **Honest response:** "Correct, there's coupling to the job/attach functions. The *boundary* is real and enforced; the *module dependency* is refactorable. I'd keep the contract and break the import coupling."
- **Survives:** the review-before-incident boundary and quality-issue model.
- **Replaced:** the processor coupling.
- **Who cares most:** all three (Thomas on responsible-AI framing).

## Stop 7 — Human review & sign-off  · MUST SHOW
- **File:** [src/lib/mii/penny.ts](../src/lib/mii/penny.ts) — `recordPennyReviewAction` (~L657–763), `signOffPennyReview` (~L767–811)
- **Symbols:** `OVERRIDE_BLOCKING` (throws without a note), `signOffPennyReview` (throws unless resolved), `signedOffBy/At`
- **Why show it:** the human-in-the-loop guards are enforced in code, not just UI.
- **Architectural point:** overrides require a note; sign-off is impossible until warnings are acknowledged and blocking issues overridden.
- **Say aloud:** "The human controls are hard guards. You can't override a blocking issue without a note — the function throws. You can't sign off until everything's resolved — it throws. This isn't UI decoration; the engine refuses the bad path."
- **Likely criticism:** "Your reviewer is a hardcoded string — sign-off isn't attributable."
- **Honest response:** "True. `Dispatcher (you)` is a constant. The *mechanism* is right; real identity has to replace the constant so sign-off is actually accountable."
- **Survives:** the enforced-guard pattern and sign-off semantics.
- **Replaced:** identity (unauthenticated today).
- **Who cares most:** Thomas and Ray.

## Stop 8 — Safety & policy gates  · MUST SHOW
- **File:** [src/lib/mii/safetyGates.ts](../src/lib/mii/safetyGates.ts) — `evaluateGates` (~L46–179), `evaluateIncidentSafetyReadiness` (~L200–240); policy [src/lib/mii/signOffPolicy.ts](../src/lib/mii/signOffPolicy.ts) (~L52–142)
- **Symbols:** Gates A–E, `submitBlockReasons`, `canSubmitMockCad`, `SignOffPolicyMode`
- **Why show it:** one source of truth drives both the visible gates and the disabled Submit button.
- **Architectural point:** blocking vs warning is explicit; the UI cannot diverge from what's actually enforced.
- **Say aloud:** "The gates are deterministic and shared. The chips you see and the reason the Submit button is disabled come from the same function, so they can't drift. Sign-off policy is separate and configurable — advisory, required-for-PENNY, or required-for-all-audio."
- **Likely criticism:** "These rules are hardcoded."
- **Honest response:** "Deliberately — they're auditable, not a black box. In production they'd become tenant-scoped configuration, but the evaluation contract stays."
- **Survives:** the gate contract and shared-source-of-truth pattern.
- **Replaced:** single global policy → tenant-scoped config.
- **Who cares most:** Thomas and Brian.

## Stop 9 — Mock CAD boundary  · MUST SHOW
- **File:** [src/lib/mii/mockCad.ts](../src/lib/mii/mockCad.ts) (~L11–57); submit path [src/lib/mii/processor.ts](../src/lib/mii/processor.ts) `submitMockCad` (~L761–781)
- **Symbols:** `buildMockCadPayload`, `MockCadPayload`, audit line "NOT SENT to any external system"
- **Why show it:** to state unambiguously there is no live CAD integration.
- **Architectural point:** CAD is a local JSON builder with redaction; no client, no transport, no idempotency, no retry.
- **Say aloud:** "This is the CAD boundary and I want to be blunt: there is no CentralSquare or One Solution integration in this repo. This builds a payload object, redacts unconfirmed sensitive fields, stores it in memory, and audits that nothing was sent. The field shape is a starting schema, nothing more."
- **Likely criticism:** "So there's no idempotency, retry, or reconciliation."
- **Honest response:** "None — and that's exactly what the real adapter has to add. I'd check One Solution's API semantics first rather than assume them."
- **Survives:** the payload field shape as a draft schema.
- **Replaced:** everything — needs a real adapter with idempotency/retry/reconciliation.
- **Who cares most:** Ray (Brian on interface).

## Stop 10 — Audit & provenance  · MUST SHOW
- **File:** [src/lib/mii/audit.ts](../src/lib/mii/audit.ts) (~L15–31); export assembly [src/lib/mii/auditExport.ts](../src/lib/mii/auditExport.ts) (~L63–127)
- **Symbols:** `makeAuditEvent`, `newCorrelationId`, `buildIncidentAuditExport`, correlation-by-plan/job
- **Why show it:** provenance threading is a strength; append-only is only a convention.
- **Architectural point:** correlation IDs thread a run; the export bundles incident + transcript + review + gates + CAD + audit events into one self-contained snapshot.
- **Say aloud:** "Every action emits an audit event, correlated so you can reconstruct a run. The export gathers the whole provenance chain for an incident into one file. The honest caveat is that the audit log is a client-mutable array — append-only by convention, not enforced."
- **Likely criticism:** "A mutable local array isn't a defensible record."
- **Honest response:** "Agreed. The *shape* and correlation model are reusable; the *sink* has to become a real append-only store."
- **Survives:** event schema, correlation concept, export bundle shape.
- **Replaced:** the in-memory sink.
- **Who cares most:** Ray and Thomas.

## Stop 11 — Audit export integrity  · MUST SHOW
- **File:** [src/lib/mii/hash.ts](../src/lib/mii/hash.ts) (~L6–20), [src/lib/mii/canonicalJson.ts](../src/lib/mii/canonicalJson.ts) (~L8–46), verify in [src/lib/mii/auditExport.ts](../src/lib/mii/auditExport.ts) (~L152–201)
- **Symbols:** `sha256Hex`, `canonicalizeForHash`, `stripAuditIntegrity`, `verifyIncidentAuditExport`, `VALID/MODIFIED/INVALID_FORMAT`
- **Why show it:** to pre-empt the "is this signed?" question honestly.
- **Architectural point:** it's an unkeyed, self-embedded SHA-256 checksum — local tamper-*evidence*, not a signature.
- **Say aloud:** "This detects accidental modification of an exported file: canonical JSON, SHA-256, recompute-and-compare. I want to be precise — it is not a digital signature. There's no key, the algorithm is public, so anyone could edit the file and recompute the hash. It's tamper-evidence for a demo, not chain of custody."
- **Likely criticism:** "So it's security theater."
- **Honest response:** "It's honest about its scope — the verify page says as much. Production needs a keyed signature or HMAC, a trusted timestamp, and external anchoring. The canonicalization work is reusable under a real signing scheme."
- **Survives:** canonicalization + verify flow shape.
- **Replaced:** keyless hash → signature + external anchor + trusted time.
- **Who cares most:** Ray and Thomas.

## Stop 12 — Client state & persistence  · MUST SHOW
- **File:** [src/lib/mii/store.ts](../src/lib/mii/store.ts) — `update` (~L170–177), `loadState`/`persist` (~L115–163), `miiStore` (~L187–403)
- **Symbols:** `miiStore`, `useSyncExternalStore`, `structuredClone`, `localStorage 'mii_lite_state_v1'`
- **Why show it:** it's a clean single-writer store — and the clearest runtime-scale limit.
- **Architectural point:** every mutation clones the whole state, runs a pure engine function, persists to localStorage, emits. One browser, one session.
- **Say aloud:** "State is a single client store. Every action clones the entire state object, applies a pure function, and persists to localStorage. It's clean and easy to reason about — and it's exactly why this doesn't scale at runtime: it's single-session, in-memory, and the clone cost grows with history. Refresh even loses the in-browser audio blob."
- **Likely criticism:** "This is a non-starter for multi-user dispatch."
- **Honest response:** "Correct, and I won't defend it as scalable. The *actions* are a good API; the persistence and transport behind them get replaced with server state, a database, and sync."
- **Survives:** the action API surface.
- **Replaced:** whole-state clone + localStorage + single-session assumption.
- **Who cares most:** Ray.

## Stop 13 — UI orchestration reality  · MUST SHOW
- **File:** [src/app/audio/AudioClient.tsx](../src/app/audio/AudioClient.tsx) (skim; call out size, `useState` cluster ~L106–141, `playAndProcess` ~L541–571)
- **Symbols:** `AudioClient`, ~24 `useState`, 31 store calls, `playAndProcess`, `syncActiveSession`
- **Why show it:** honesty about the biggest debt — the workflow lives half in this component.
- **Architectural point:** 1475-line god component owns eight workflows and coordinates domain transitions with local React state.
- **Say aloud:** "I'll be candid — this is the file I'd refactor first. It's 1475 lines, ~24 pieces of local state, 31 store calls, driving eight distinct workflows. The workflow sequencing lives here in the UI instead of in the domain. It works for a demo, but it's the clearest orchestration debt."
- **Likely criticism:** "Business logic in a React component is a maintenance trap."
- **Honest response:** "Agreed. Step two of my evolution plan is pulling orchestration out into per-workflow hooks or a controller/service layer, then durable workflow state behind that."
- **Survives:** the individual store actions it calls.
- **Replaced:** the component's orchestration role.
- **Who cares most:** Brian.

## Stop 14 — Verification harness  · MUST SHOW
- **File:** [scripts/verify-mii.ts](../scripts/verify-mii.ts) (skim structure ~L160–188, counts)
- **Symbols:** `check`/`checkAsync`, `eq`/`ok`/`includes`, 108 checks, `npm run verify:mii`
- **Why show it:** to state precisely what "108 passed" proves.
- **Architectural point:** a hand-rolled harness over the pure domain library — no framework, no React/store/persistence, no real ASR.
- **Say aloud:** "There's a 108-check harness. I want to be exact about what it proves: it's a deterministic regression guard on the domain engine — extraction, the ASR job and PENNY state machines, the gates, and the tamper-evidence, including failure and override paths. It does not test the UI, the store, persistence, real Whisper inference, or concurrency. It's a domain smoke test, not end-to-end."
- **Likely criticism:** "108 passing tests means little if the UI and store are untested."
- **Honest response:** "Which is why I'm not calling it end-to-end. It's genuine coverage of the logic that matters most, and I know exactly what's missing."
- **Survives:** the harness as a starting spec.
- **Replaced:** needs real framework + UI/store/integration/e2e + real-ASR tests.
- **Who cares most:** Brian (Thomas on evaluation methodology).

## Stop 15 — Scalability conclusion  · MUST SHOW (verbal close)
- **Files:** none — summarize.
- **Say aloud:** "To close: separate the two questions. Conceptually — the domain model, the ASR seam, the PENNY trust boundary, the gate and policy contracts, the audit schema — those scale as ideas and I'd carry them forward. Runtime — single browser, in-memory, whole-state clone, no server, no queue, no worker, no tenant isolation, keyless verification — none of that scales, and each piece gets replaced, not tuned. MII_lite is a domain and workflow proof and a source of reusable contracts. It is not the production architecture and I'm not presenting it as one."
- **Who cares most:** all three.

---

### DO NOT WASTE TIME (mention only if directly asked)
- Presentational cards in [src/components/](../src/components/) — cosmetic.
- [src/theme.ts](../src/theme.ts), [src/app/layout.tsx](../src/app/layout.tsx) — framework boilerplate.
- [src/lib/demoAuth.ts](../src/lib/demoAuth.ts) / [src/proxy.ts](../src/proxy.ts) — one sentence: "shared static demo token, not access control." (SHOW IF ASKED by Ray.)
- [src/lib/mii/seed.ts](../src/lib/mii/seed.ts), [src/lib/mii/dictionary.ts](../src/lib/mii/dictionary.ts) — fixtures.

### Time budget
Stops 1–2 (~3 min) · 3–6 (~9 min, the core) · 7–11 (~8 min) · 12–14 (~6 min) · 15 (~2 min). If short on time, keep 3, 5, 6, 9, 11, 12, 15 and compress the rest.
