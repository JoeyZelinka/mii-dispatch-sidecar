# Architecture

Current runtime architecture of MII_lite. This documents what exists in the repository today — not a production target architecture.

## Current Runtime

The browser owns the workflow:

- **React UI** calls `miiStore` actions (e.g., `processTranscriptLine`, `submitMockCad`, `signOffPennyReview`)
- **miiStore** structured-clones state, calls deterministic domain functions, writes the result back, and persists to localStorage
- **Domain functions** are pure — they take `MiiState` (or a subset) as input and return updated state or derived values
- **Next.js server** is thin — it serves static assets and runs a demo-auth cookie gate (`proxy.ts`). No domain logic executes server-side.
- **External integrations** remain mocked or experimental — no live CAD, no production ASR, no durable backend

### Key Runtime Characteristics

| Aspect | Current Implementation |
|--------|----------------------|
| Execution | Browser main thread |
| State | `miiStore` singleton via `useSyncExternalStore` |
| Persistence | `localStorage` under key `mii_lite_state_v1` |
| Mutation model | Structured clone → pure function → write-back |
| ASR | Deterministic mock + safe-failing placeholder providers, 1 experimental local Whisper |
| CAD | Mock payload builder, "NOT SENT" |
| Identity | Hardcoded `"Dispatcher (you)"` |
| Audit | In-memory array, append-only by convention |

## Runtime Diagram

```mermaid
graph TD
    subgraph Browser
        UI[React UI / Pages]
        Store[miiStore singleton]
        LS[(localStorage)]

        subgraph Domain Engine
            Proc[processor.ts]
            Ext[extractor.ts]
            Cue[cueDetector.ts]
            Sem[semanticClassifier.ts]
            Conf[conflictDetector.ts]
            Gates[safetyGates.ts]
            SignOff[signOffPolicy.ts]
            MockCAD[mockCad.ts]
            Audit[auditExport.ts]
        end

        subgraph PENNY
            QE[Quality Evaluation]
            Review[Human Review]
            SO[Sign-off]
        end

        subgraph ASR Providers
            Mock[Mock / Placeholder Adapters]
            Whisper[Local Whisper - experimental]
        end
    end

    UI --> Store
    Store <--> LS
    Store --> ASR Providers
    ASR Providers --> PENNY
    PENNY --> Review
    Review --> SO
    SO --> Proc
    Proc --> Ext
    Proc --> Cue
    Proc --> Sem
    Proc --> Conf
    Proc --> Gates
    Proc --> MockCAD
    Proc --> Audit

    style Whisper stroke-dasharray: 5 5
    style MockCAD stroke-dasharray: 5 5
```

The dashed borders indicate experimental (Whisper) and mock (CAD) boundaries.

## End-to-End Workflow

```
Audio / Scenario Input
  │
  ▼
ASR Provider Selection
  │  (mock scenario adapter or experimental local Whisper)
  ▼
ASR Job Lifecycle
  │  (PENDING → STARTED → COMPLETED or FAILED)
  ▼
PENNY Quality Evaluation
  │  (confidence checks, empty/failed detection, admin-chatter classification)
  ▼
Issue Classification
  │  (BLOCKING, WARNING, or clean)
  ▼
Human Review
  │  (acknowledge warnings, override blocking issues with documented note)
  ▼
Sign-off
  │  (throws if unresolved issues remain)
  ▼
Transcript Attachment
  │  (governed transcript package attached to incident)
  ▼
Deterministic Incident Processing
  │  (extraction, classification, field population, conflict detection)
  ▼
Safety Gate Evaluation
  │  (Gates A–E: ASR confirmation, unit assignment, core fields, sensitive policy, conflict resolution)
  ▼
Mock CAD Payload Construction
  │  (field redaction, sensitive-data gating, "NOT SENT" audit)
  ▼
Audit Export
  │  (canonical JSON serialization, SHA-256 integrity hash)
  ▼
Integrity Verification
     (re-hash and compare to detect modification)
```

## Main Module Boundaries

### `src/lib/mii/` — Domain Library

The core domain library has no dependencies on React, Next.js, or browser APIs (except `crypto.subtle` for SHA-256). Modules are organized by responsibility:

| Module | Responsibility |
|--------|---------------|
| `types.ts` | Complete domain type vocabulary — shared contract across all modules |
| `processor.ts` | Incident processing engine — extraction, classification, conflict detection, CAD construction |
| `penny.ts` | Transcript quality evaluation, issue classification, review actions, sign-off |
| `store.ts` | Client-side state management — structured clone, domain function dispatch, localStorage sync |
| `safetyGates.ts` | Safety gate definitions and evaluation |
| `signOffPolicy.ts` | Sign-off policy modes and evaluation |
| `transcriptReviewGate.ts` | Gate logic blocking transcript attachment until PENNY review completes |
| `extractor.ts` | Regex-based field extraction from transcript text |
| `cueDetector.ts` | Routing and officer-opener cue detection |
| `semanticClassifier.ts` | Transcript line semantic classification |
| `conflictDetector.ts` | Contradictory fact detection across transcript lines |
| `mockCad.ts` | Mock CAD payload builder with redaction |
| `audit.ts` | Audit event model and correlation |
| `auditExport.ts` | Export serialization and integrity hash |
| `canonicalJson.ts` | Deterministic JSON serialization |
| `hash.ts` | SHA-256 wrapper |
| `seed.ts` | Synthetic scenario and unit seed data |
| `demoContent.ts` | Guided demo narrative, scenario purposes, and explanations |

### `src/lib/mii/asr/` — ASR Provider Subsystem

| Module | Responsibility |
|--------|---------------|
| `types.ts` | ASR provider interface and result types |
| `providerRegistry.ts` | Provider registration and selection |
| `mockAsrAdapter.ts` | Mock ASR adapters linked to seeded scenarios |
| `localOfflineWhisperAdapter.ts` | Experimental browser-local Whisper inference |
| `localOfflineHandoff.ts` | Handoff from local Whisper result to PENNY |
| `localOfflineAsrAssets.ts` | Model file presence detection |
| `localOfflineAudio.ts` | Audio format handling for local inference |
| `localOfflineTypes.ts` | Types for local offline ASR path |

### `src/app/` — Next.js Pages

Thin React shells that call `miiStore` actions and render domain state. No domain logic lives in page components. The notable exception is `AudioClient.tsx`, which concentrates audio intake orchestration (recording, provider selection, PENNY review, attachment) in a single large component — this is a known structural limitation.

## What Is Structurally Reusable

These elements carry forward to production independent of runtime implementation:

- **Domain vocabulary** — `types.ts` defines the shared type contract
- **ASR provider concept** — the abstraction that separates transcription from domain logic
- **PENNY trust boundary** — quality evaluation, review, sign-off as a governance pattern
- **Review and sign-off semantics** — enforcement in domain logic, not just UI
- **Safety gate contracts** — single-sourced gate definitions and evaluation
- **Provenance and audit-event concepts** — correlation IDs, event model, traceable actions
- **Deterministic regression scenarios** — seed data and verification checks

## What Requires Replacement

These elements are prototype-specific and do not carry forward as-is:

- **Browser-local singleton runtime** — replaced with server-side execution
- **localStorage persistence** — replaced with a durable state store
- **UI-driven orchestration** (`AudioClient.tsx`) — replaced with a workflow controller or service
- **Demo identity** (`"Dispatcher (you)"`) — replaced with authenticated identity
- **Mock ASR implementations** — replaced with evaluated, authorized ASR providers
- **Experimental local Whisper** — evaluated for feasibility; production ASR strategy TBD
- **Mock CAD** — replaced with real CAD transport (idempotency, retry, reconciliation)
- **Unkeyed integrity hash** — replaced with keyed signature, trusted timestamp, immutable store
- **Hardcoded single-agency configuration** — replaced with tenant-aware, multi-agency configuration

## Possible Production Evolution

The following describes one possible direction, not a finalized roadmap:

1. **Harden domain contracts** — runtime validation alongside compile-time types
2. **Extract orchestration from UI** — move `AudioClient` workflow logic into a controller/service layer
3. **Durable workflow state** — server-authoritative state store replacing localStorage
4. **Asynchronous workers** — queue-driven ASR job advancement replacing synchronous step-per-call
5. **Tenant-aware configuration** — per-tenant/agency rules, dictionaries, and policies
6. **Authorized audio sources** — real recording ingestion (Eventide, Barix) replacing browser file upload
7. **Production ASR evaluation** — evaluated provider with labeled authorized radio traffic
8. **Real CAD adapter** — One Solution integration with transport, idempotency, and reconciliation
9. **Real identity and audit** — authenticated review, signed audit, production observability

Standing principle: identify what CentralSquare's platform already provides — tenancy, identity, eventing, durable state, audit anchoring, observability, ASR at scale, CAD transport — before building new services.
