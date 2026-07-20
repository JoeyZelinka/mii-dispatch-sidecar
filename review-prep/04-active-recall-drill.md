# Active-Recall Drill — MII_lite

Answer each prompt out loud **before** expanding the answer. Answers are concise enough to speak. Goal: fluency, not memorization — if your words differ but the substance matches, that's a pass.

---

## Architecture fundamentals

**1. In one sentence, what is MII_lite?**
<details><summary>Answer</summary>A browser-local, deterministic prototype that turns a dispatch radio transcript into an incident, safety-gated with human review, ending at a mock CAD payload and a tamper-evident audit export.</details>

**2. Where does execution happen?**
<details><summary>Answer</summary>Almost entirely in the browser. Next.js pages are thin shells; the only server code is a cookie gate and two demo-auth routes.</details>

**3. Where does state live today?**
<details><summary>Answer</summary>In one client singleton store, `miiStore`, on `useSyncExternalStore` + `localStorage` under key `mii_lite_state_v1`. Single browser, single session.</details>

**4. How is a mutation applied?**
<details><summary>Answer</summary>`update()` structuredClones the whole state, runs a pure engine function on the draft, reassigns, persists to localStorage, emits. One auditable transition per action.</details>

**5. Is there any AI/LLM in the incident pipeline?**
<details><summary>Answer</summary>No. Cue detection, field extraction, and classification are regex and branch rules. The only ML anywhere is the experimental local Whisper on the audio page.</details>

**6. What's the single strongest architectural idea?**
<details><summary>Answer</summary>PENNY as a provider-agnostic trust boundary: no transcript reaches an incident without quality-gating and human sign-off, regardless of which ASR produced it.</details>

**7. Name the two biggest technical-debt hotspots.**
<details><summary>Answer</summary>`AudioClient.tsx` (1475-line god component, eight workflows) and `processor.ts` (1424 lines, owns the state type and most engine logic).</details>

---

## Runtime flow

**8. Trace the full happy path in order.**
<details><summary>Answer</summary>Audio intake → provider selection → ASR job lifecycle → PENNY quality evaluation → human review → sign-off → transcript attachment → incident processing → safety/policy gates → mock CAD → audit export → verification.</details>

**9. What are the ASR job states?**
<details><summary>Answer</summary>REQUESTED → QUEUED → TRANSCRIBING → COMPLETED / FAILED / CANCELLED, advanced one step per `advanceAsrJob` call, deterministically.</details>

**10. Is the ASR job lifecycle truly asynchronous/distributed?**
<details><summary>Answer</summary>No. It models the lifecycle but runs synchronously, one step per call. No queue, no workers, no distribution.</details>

**11. What triggers incident creation versus update?**
<details><summary>Answer</summary>The semantic classifier: NEW_EVENT with incident-defining facts creates; UPDATE merges; CONFIRMATION boosts confidence without duplicating; ADMIN_CHATTER creates nothing.</details>

**12. What happens on a material field contradiction?**
<details><summary>Answer</summary>A `FieldConflict` is raised, the incident enters CONFLICT status, CAD is blocked, and a human must resolve it before proceeding.</details>

**13. What survives a browser refresh, and what doesn't?**
<details><summary>Answer</summary>State in localStorage survives; the in-memory audio blob URL does not — so a recording session can dangle with no audio after refresh.</details>

---

## ASR and PENNY

**14. How many ASR providers, and what kind?**
<details><summary>Answer</summary>Five: two deterministic mocks, two inert stubs, one experimental real local Whisper.</details>

**15. Why is PENNY separate from ASR?**
<details><summary>Answer</summary>ASR is a replaceable, fallible engine. The trust decision — is this transcript good enough to touch an incident — must live in one auditable place independent of the engine. PENNY is that boundary; it never does ASR, creates incidents, or writes CAD.</details>

**16. What weakens that separation in the current code?**
<details><summary>Answer</summary>The real Whisper provider bypasses the job abstraction and injects via a handoff; PENNY imports processor functions; the adapter contract is synchronous; and Whisper confidence is faked to trip review.</details>

**17. Does the local Whisper path actually run as shipped?**
<details><summary>Answer</summary>No — the model weights aren't in the repo (`public/models` is empty). It's real inference code but unproven and never exercised by the tests.</details>

**18. Where does confidence come from?**
<details><summary>Answer</summary>Mocks fabricate it deterministically from line content; Whisper exposes none, so the handoff stamps a conservative placeholder that forces review. It drives workflow, not calibrated risk.</details>

**19. What are PENNY's quality thresholds?**
<details><summary>Answer</summary>Segment confidence below 0.55 is BLOCKING; below 0.8 is WARNING. Empty or failed transcripts are BLOCKING.</details>

**20. What does the local-offline handoff do?**
<details><summary>Answer</summary>`completeLocalOfflineAsrForPlan` stores the Whisper output as an ASR result, links it to the PENNY plan, and runs PENNY evaluation so the flow lands at human review. It never attaches or processes.</details>

---

## Safety and human control

**21. Name the five safety gates.**
<details><summary>Answer</summary>A ASR confirmed, B required unit, C core fields (nature + location), D sensitive-field policy (warning only), E conflict state. Plus review and sign-off-policy gates fold into readiness.</details>

**22. Which gates block and which only warn?**
<details><summary>Answer</summary>Block: A, C, E (and B when a unit is required), plus BLOCKED review/policy. Warn only: D (unconfirmed sensitive), review WARNING, policy ADVISORY.</details>

**23. Why do the visible gates and the disabled Submit button never diverge?**
<details><summary>Answer</summary>Both read the same `evaluateGates`/`submitBlockReasons` source of truth, so the UI can't drift from what's enforced.</details>

**24. How is human review enforced beyond the UI?**
<details><summary>Answer</summary>In code: overriding a blocking issue without a note throws; signing off before issues are resolved throws.</details>

**25. Can human review be safely bypassed?**
<details><summary>Answer</summary>No. It's enforced by hard guards in the engine, not just UI state, and the unsafe path is refused at the function level.</details>

**26. What's wrong with reviewer identity today?**
<details><summary>Answer</summary>It's a hardcoded string, `Dispatcher (you)`. The sign-off mechanism is right, but attribution isn't real until authenticated identity replaces the constant.</details>

**27. How are sensitive fields handled?**
<details><summary>Answer</summary>Flagged at extraction (plate/tag), redacted from the mock CAD payload unless explicitly confirmed and inclusion is on. Gate D warns but never blocks.</details>

---

## CAD and audit

**28. Is the CAD integration real?**
<details><summary>Answer</summary>No. It's a local JSON builder with redaction, stored in memory, audited as "NOT SENT." There is no CentralSquare/One Solution client, transport, idempotency, retry, or reconciliation.</details>

**29. Are duplicate CAD writes prevented?**
<details><summary>Answer</summary>Not today — re-submit overwrites with a new timestamp, no idempotency key. Real prevention needs an idempotency key and a reconciliation model on the adapter.</details>

**30. What's in an incident audit export?**
<details><summary>Answer</summary>The incident, transcript-review and sign-off-policy gates, safety readiness, audio assets/attachments, ASR jobs/results, PENNY plans/packages/reviews, correlated audit events, and the mock CAD payload — one self-contained snapshot.</details>

**31. How does the export integrity check work?**
<details><summary>Answer</summary>Canonical JSON (sorted keys), SHA-256 over the integrity-stripped content, hash embedded in the file; the verifier recomputes and compares → VALID / MODIFIED / INVALID_FORMAT.</details>

**32. Is the audit export cryptographically signed?**
<details><summary>Answer</summary>No. It's an unkeyed, self-embedded SHA-256 checksum — local tamper-evidence. No key, public algorithm, so anyone could edit and re-hash. Not a signature, not chain of custody.</details>

**33. What is the audit log's real weakness?**
<details><summary>Answer</summary>It's a client-mutable array; append-only is a convention, not enforced. The schema and correlation model are reusable; the sink must become a real append-only store.</details>

---

## Testing

**34. What does `npm run verify:mii` run?**
<details><summary>Answer</summary>A hand-rolled harness, `scripts/verify-mii.ts`, with 108 checks over the pure domain library. No jest/vitest.</details>

**35. What do the 108 checks actually prove?**
<details><summary>Answer</summary>That the deterministic engine behaves as designed — extraction, ASR job and PENNY state machines, gates, tamper-evidence — including failure and override paths.</details>

**36. What do they NOT prove?**
<details><summary>Answer</summary>Anything about the UI, store, persistence, real Whisper inference, concurrency, or end-to-end behavior. It's a domain smoke test, not e2e.</details>

**37. What's a subtle risk in the harness itself?**
<details><summary>Answer</summary>It re-implements `freshState()` locally instead of importing it, so it can drift from the real store's initial state.</details>

**38. Does the harness use a fixed clock or seed?**
<details><summary>Answer</summary>No injected clock or seed. It asserts existence of engine-generated timestamps and hardcodes fixtures where hashing must be stable; cross-run hash reproducibility isn't established.</details>

---

## Scalability

**39. Does the current code scale?**
<details><summary>Answer</summary>Conceptually yes — the domain model, ASR seam, PENNY boundary, gate/policy contracts, and audit schema. At runtime no — single browser, in-memory, whole-state clone, no server/queue/worker/tenant isolation. Concepts carry forward; runtime pieces get replaced.</details>

**40. What breaks first under load?**
<details><summary>Answer</summary>The main thread and the growing whole-state clone cost within a session, plus local Whisper blocking the UI. And structurally it can't do multi-user at all — one browser, one session.</details>

**41. Why is browser-local execution a problem for production?**
<details><summary>Answer</summary>No shared state, no durability, heavy work on the UI thread, and no path to multi-user dispatch. Processing must move to server/worker tiers.</details>

**42. Is the app multi-tenant?**
<details><summary>Answer</summary>No. Tenant/agency are schema fields but hardcoded constants; one global policy; single-agency dictionaries. Concept present, isolation absent.</details>

---

## Production evolution

**43. What would you replace first?**
<details><summary>Answer</summary>The `AudioClient` orchestration and the store's persistence — pull workflow out of the UI, then put durable state behind the action API. Contract-hardening comes alongside so replacements sit behind stable interfaces.</details>

**44. Which concepts survive productionization?**
<details><summary>Answer</summary>Domain types, the ASR registry/adapter pattern, the PENNY trust boundary, the gate and policy contracts, the audit event/correlation schema, and the harness as a spec.</details>

**45. How would tenant context enter and propagate?**
<details><summary>Answer</summary>Established at authenticated session/entry, carried on every operation, scoping config, policy, storage, audit, and CAD payloads — replacing the hardcoded tenant/agency constants.</details>

**46. How would you prevent duplicate CAD writes in production?**
<details><summary>Answer</summary>A client-supplied idempotency key on the CAD adapter plus reconciliation against the system of record — after checking One Solution's actual write semantics.</details>

**47. What must be checked against CentralSquare before building?**
<details><summary>Answer</summary>Tenancy, identity, eventing/queues, durable state, audit anchoring, and observability — consume the platform service if it exists rather than rebuild.</details>

**48. One sentence to close the review honestly.**
<details><summary>Answer</summary>"MII_lite is a domain and workflow proof with reusable contracts and honest boundaries; it is not the production architecture and I'm not presenting it as scalable at runtime."</details>
