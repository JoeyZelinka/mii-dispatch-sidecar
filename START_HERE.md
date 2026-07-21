# Start Here

Orientation guide for MII_lite.

## Fastest Path

1. Read [README.md](README.md) for project context
2. `npm ci`
3. `npm run dev`
4. Open [http://localhost:3000/demo](http://localhost:3000/demo)
5. Select **Medical 3-41**, click "Replay with delay," watch the Live Demo Feed
6. `npm run verify:mii` — confirm 108 domain checks pass

## Recommended Reading Order

1. [README.md](README.md) — what MII_lite is, setup, and guided demo instructions
2. [ARCHITECTURAL_DECISIONS.md](ARCHITECTURAL_DECISIONS.md) — why the prototype is shaped this way
3. [docs/architecture.md](docs/architecture.md) — runtime architecture, workflow, and module boundaries
4. [docs/penny.md](docs/penny.md) — PENNY transcript governance reference
5. [docs/known-limitations.md](docs/known-limitations.md) — honest limitations and scope boundaries
6. [review-prep/07-one-page-hit-sheet.md](review-prep/07-one-page-hit-sheet.md) — supplementary one-page architecture summary (internal review material)

## Key Repository Files

| File | Why it matters |
|------|----------------|
| `src/app/audio/AudioClient.tsx` | Audio intake orchestration — recording, ASR provider selection, PENNY review, and transcript attachment in one client component |
| `src/lib/mii/store.ts` | Single-writer state management — every domain mutation flows through `miiStore` actions |
| `src/lib/mii/processor.ts` | Deterministic incident processing engine — extraction, classification, conflict detection, and CAD construction |
| `src/lib/mii/types.ts` | Complete domain type vocabulary — the shared contract between all modules |
| `src/lib/mii/penny.ts` | PENNY quality evaluation, issue classification, review actions, and sign-off enforcement |
| `src/lib/mii/transcriptReviewGate.ts` | Gate logic that blocks transcript attachment until PENNY review is complete |
| `src/lib/mii/signOffPolicy.ts` | Configurable sign-off policy evaluation (advisory, required-for-PENNY, required-for-all) |
| `src/lib/mii/safetyGates.ts` | Safety gate definitions and evaluation — conditions that must be met before CAD submission |
| `src/lib/mii/mockCad.ts` | Mock CAD payload builder with field redaction and sensitive-data gating |
| `src/lib/mii/auditExport.ts` | Audit export serialization and SHA-256 integrity hash generation |
| `src/lib/mii/asr/providerRegistry.ts` | ASR provider abstraction — registry of available transcription providers |
| `src/lib/mii/asr/localOfflineWhisperAdapter.ts` | Experimental browser-local Whisper inference via Transformers.js |
| `scripts/verify-mii.ts` | 108-check domain regression harness — the primary automated verification |
