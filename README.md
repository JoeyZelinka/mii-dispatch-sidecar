# MII_lite

## Overview

MII_lite is a deterministic public-safety workflow prototype exploring how authorized radio-derived transcript information can become governed, human-reviewed incident context.

It implements end-to-end domain logic — from audio intake through ASR provider selection, transcript quality governance (PENNY), human review and sign-off, deterministic incident processing, safety gates, mock CAD payload construction, and tamper-evident audit export — entirely within a browser-local Next.js application.

MII_lite is not the proposed final Project Echo production architecture. It is a domain and workflow proof-of-concept built to validate operational correctness before investing in distributed infrastructure.

## Design Philosophy

This prototype intentionally validates operational workflow before distributed architecture. The goal is to establish whether the domain model, trust boundaries, deterministic processing, provenance, and human-review workflow are sound before investing in production infrastructure.

## What This Repository Validates

- Deterministic incident-processing behavior from transcript input to structured output
- ASR provider boundaries — abstraction that separates transcription from domain logic
- PENNY transcript governance — quality evaluation, issue classification, and human review before any transcript influences incident state
- Required human review and sign-off — enforced in domain logic, not just UI
- Explicit safety and policy gates that block progression when conditions are unmet
- Conflict detection and resolution for contradictory extracted facts
- Mock CAD payload construction with field redaction and sensitive-data gating
- Provenance and audit export with local integrity verification (SHA-256)
- Domain regression verification — 108 deterministic checks covering extraction, state machines, gates, and failure paths

## What It Intentionally Does Not Establish

- Production scalability or distributed runtime
- Durable workflow state or persistence beyond localStorage
- Multi-user or multi-tenant behavior
- Live CAD integration (One Solution or otherwise)
- Production ASR accuracy or evaluation against authorized radio traffic
- Production authentication or authorization
- Legal chain of custody or cryptographically signed audit
- Production resilience, observability, or load characteristics

## Current Architecture

MII_lite runs as a Next.js client application where all domain logic executes in the browser:

- **Runtime:** Browser-local. The Next.js server provides static assets and a demo-auth cookie gate; all reasoning runs client-side.
- **State:** `miiStore` singleton backed by `useSyncExternalStore` with localStorage persistence under key `mii_lite_state_v1`.
- **Domain engine:** Deterministic modules — `processor.ts`, `extractor.ts`, `cueDetector.ts`, `semanticClassifier.ts`, `conflictDetector.ts`, `safetyGates.ts`, `signOffPolicy.ts`. No LLM in the processing pipeline.
- **ASR:** Provider registry with deterministic mock providers, safe-failing placeholder providers, and one experimental local Whisper path (Transformers.js/WASM, browser-local).
- **PENNY:** Trust boundary between any ASR engine and incident processing. Quality-gates transcripts, enforces human review, records provenance.
- **CAD:** Mock payload builder. Constructs a redacted JSON object; does not send it anywhere.
- **Audit:** Event model with correlation IDs, canonical JSON serialization, and SHA-256 integrity hash. Local tamper-evidence, not a digital signature.

For detailed architecture, see:
- [docs/architecture.md](docs/architecture.md) — runtime architecture and workflow diagrams
- [docs/penny.md](docs/penny.md) — PENNY governance reference
- [docs/known-limitations.md](docs/known-limitations.md) — consolidated limitations
- [ARCHITECTURAL_DECISIONS.md](ARCHITECTURAL_DECISIONS.md) — key design decisions and reasoning
- [START_HERE.md](START_HERE.md) — orientation and recommended reading order

## Prerequisites

- **Node.js >= 20.9.0** (required by Next.js 16.2.4; declared in `engines` field)
- **npm** (ships with Node.js; `package-lock.json` is committed)
- No external services, databases, or API keys required for local development

## Installation

```bash
npm ci
```

Uses the committed `package-lock.json` for deterministic dependency resolution.

## Environment Configuration

The application runs with demo authentication disabled by default — no `.env` file is required.

See [.env.example](.env.example) for available configuration. All included values are placeholders or demo defaults. To customize:

```bash
cp .env.example .env.local
```

Demo authentication is a lightweight shared-access-code gate, not production access control. See [docs/known-limitations.md](docs/known-limitations.md) for details.

## Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard and all routes are immediately accessible when demo auth is disabled (the default).

## Guided Demo

Navigate to [http://localhost:3000/demo](http://localhost:3000/demo) to access four synthetic, deterministic scenarios:

1. **Medical 3-41** — Routing cues, signal translation, zone resolution, unit assignment, mock CAD submission
2. **Traffic Stop 19** — Officer-opener detection, vehicle/plate extraction, sensitive-field gating and redaction
3. **Address Conflict** — Contradictory address detection, CONFLICT state, Safety Gate E blocking CAD until resolution
4. **Admin Chatter** — Routine administrative traffic correctly classified with no incident created

All scenarios use seeded synthetic data. No real radio traffic, CAD data, or agency information is included.

**Recommended first run:** Select Medical 3-41, click "Replay with delay," and observe the Live Demo Feed as each transcript line is processed with explanations of cue detection, semantic classification, and incident field extraction.

## Verification

```bash
npm run verify:mii
```

Runs 108 domain regression checks covering:
- Scenario extraction and incident processing
- ASR job lifecycle state machine
- PENNY quality evaluation and review workflow
- Safety gates (A through E)
- Sign-off policy modes
- Conflict detection and resolution
- Mock CAD payload construction and redaction
- Audit export integrity and tamper detection
- Recording session lifecycle
- Local Whisper handoff (safe degradation when model absent)

This is a domain-logic harness, not a UI test suite or end-to-end production validation. It does not exercise real Whisper inference, React components, localStorage persistence, or concurrent workflows.

## Production Build

```bash
CI=true npm run build
```

The `CI=true` prefix ensures the build output goes to the standard `.next/` directory. Without it, local macOS builds write to `.next.nosync/` to avoid iCloud Drive sync interference (see `next.config.ts`).

## Experimental Local Whisper

MII_lite includes an experimental browser-local ASR path using Transformers.js (Whisper-tiny via WASM/WebAssembly):

- Model files are **not shipped** with the repository (excluded via `.gitignore`)
- The path has **not been validated** against authorized radio traffic
- It is **not public-safety-grade** — it demonstrates feasibility of on-device transcription only
- Human review via PENNY remains required regardless of ASR provider
- See `public/models/README.md` for model setup instructions

When model files are absent, the application degrades safely — the experimental provider is unavailable, but all other functionality (mock ASR, guided demo, verification) works normally.

## Repository Structure

```
src/
  app/              Next.js pages and route handlers
    audio/           Audio intake and recording flow
    demo/            Guided demo with synthetic scenarios
    incidents/       Incident detail views
    audit/           Audit log and export verification
    api/             Demo authentication API routes
  components/        Reusable UI components
  lib/
    mii/             Core domain library
      asr/           ASR provider registry and adapters
      processor.ts   Deterministic incident processing engine
      penny.ts       Transcript quality governance (PENNY)
      store.ts       Client-side state management
      types.ts       Domain type vocabulary
      safetyGates.ts Safety gate evaluation
      signOffPolicy.ts Sign-off policy enforcement
      mockCad.ts     Mock CAD payload builder
      auditExport.ts Audit export with integrity hash
    demoAuth.ts      Demo authentication helpers
scripts/
  verify-mii.ts     108-check domain regression harness
docs/                Architecture and reference documentation
review-prep/         Supplementary internal engineering notes
public/
  models/            Local ASR model assets (not committed)
```

## Security and Data Handling

- No real radio recordings, dispatch audio, or agency data is committed to this repository
- No real CAD data or production system credentials are present
- All demo scenarios use synthetic, deterministic data with fictional names and addresses
- Demo authentication is a shared-access-code gate, not production access control
- The local audit integrity mechanism is an unkeyed SHA-256 hash — local tamper-evidence only, not a digital signature, cryptographic proof, or legal chain-of-custody mechanism
- Environment secrets (if any) are excluded from version control via `.gitignore`

## Known Limitations

See [docs/known-limitations.md](docs/known-limitations.md) for a consolidated, candid list of current prototype limitations across runtime, ASR, workflow, CAD, audit, verification, and code structure.
