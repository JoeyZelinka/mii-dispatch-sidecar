# PENNY — Provenance Engine for Normalized Narrative Yield

## Purpose

PENNY governs the transition from an ASR result to a human-approved transcript package that may influence incident processing.

It exists as an independent trust boundary between any ASR engine and the domain logic that creates, updates, and acts on incidents. PENNY does not perform transcription. It evaluates whether a transcript is sufficiently governed and reviewed to participate in operational decision-making.

## Core Distinction

ASR asks: *"What words does the system believe were spoken?"*

PENNY asks: *"Is this transcript sufficiently governed and reviewed to participate in operational decision-making?"*

These are different questions with different accountability requirements. Separating them means changing the ASR provider does not change the governance model.

## Inputs

A PENNY plan is created from:

- **ASR result** — transcript text, segments with timing and confidence, provider identification
- **Source linkage** — which audio source, recording session, or scenario produced the result
- **Plan metadata** — creation timestamp, correlation ID, provider reference

PENNY does not require a specific ASR provider. Mock providers, scenario-linked providers, and the experimental local Whisper adapter all produce results that flow through the same evaluation.

## Processing Responsibilities

### Quality Evaluation

PENNY evaluates the incoming ASR result and classifies issues:

- **Segment confidence** — segments below threshold trigger warnings or blocking issues
- **Empty or failed transcripts** — blocked from proceeding
- **Admin chatter detection** — routine administrative traffic classified appropriately
- **Overall quality assessment** — summary confidence and quality indicators

### Issue Classification

Issues are classified by severity:

| Severity | Meaning | Human action required |
|----------|---------|----------------------|
| `BLOCKING` | Transcript cannot proceed without explicit human override | Override with documented note |
| `WARNING` | Transcript may proceed after human acknowledgement | Acknowledge the warning |
| Clean (no issues) | Transcript meets quality threshold | Sign-off only |

### Human Review Workflow

1. **Review pending** — issues are presented to the human reviewer
2. **Acknowledge warnings** — reviewer confirms awareness of quality concerns
3. **Override blocking issues** — reviewer provides a documented note explaining the override decision
4. **Sign-off** — reviewer signs off on the governed transcript package

Sign-off throws if unresolved issues remain. Override without a note throws. These are domain-logic guards, not UI-only checks.

### Provenance and Audit

Every review action generates an audit event:
- Issue acknowledgement (which issue, by whom, when)
- Override with note (which blocking issue, the note text, by whom, when)
- Sign-off (reviewer identity, timestamp)

## Outputs

A completed PENNY review produces a **governed transcript package** containing:

- The original ASR result
- Quality evaluation results and issue history
- Review action log (acknowledgements, overrides with notes)
- Sign-off record (reviewer, timestamp)
- Provenance metadata (plan ID, correlation, provider reference)

This package is what gets attached to an incident. The raw ASR result alone cannot influence incident state.

## Human Control

PENNY cannot silently bypass human review or sign-off:

- No transcript entering through the PENNY-controlled workflow reaches incident processing without completed review and sign-off under the active policy
- Blocking issues require explicit human override with a documented justification
- Sign-off requires all issues resolved (acknowledged or overridden)
- The enforcement is in the domain layer — any caller (UI, API, test harness) is subject to the same rules

## What PENNY Does Not Do

- **Does not perform ASR** — it consumes ASR results, it does not produce them
- **Does not determine objective truth** — it evaluates governance readiness, not transcript accuracy
- **Does not independently create incidents** — incident creation is a separate domain responsibility
- **Does not assign units** — unit recommendation and assignment are separate concerns
- **Does not submit CAD** — CAD payload construction and submission are downstream
- **Does not replace accountable human judgment** — it structures and enforces the review process; the human makes the decision

## Current Implementation

| File | Role |
|------|------|
| `src/lib/mii/penny.ts` | Quality evaluation, issue classification, review actions, sign-off enforcement |
| `src/lib/mii/types.ts` | PENNY-related type definitions (plans, issues, review state, transcript packages) |
| `src/lib/mii/transcriptReviewGate.ts` | Gate logic blocking transcript attachment until PENNY review completes |
| `src/lib/mii/signOffPolicy.ts` | Configurable sign-off policy modes (advisory, required-for-PENNY, required-for-all) |
| `src/lib/mii/asr/localOfflineHandoff.ts` | Handoff from local Whisper result into a PENNY plan |

## Current Limitations

- **Browser-local workflow** — PENNY runs in the browser; no durable review service exists
- **Fixed thresholds** — confidence thresholds are constants, not tenant-configurable
- **Synthetic/mock confidence** — mock providers fabricate confidence values; experimental Whisper uses a conservative placeholder (0.7) to force review
- **Hardcoded identity** — reviewer is `"Dispatcher (you)"`, not an authenticated user
- **Implementation coupling** — PENNY functions operate on `MiiState` directly rather than through a formal service interface
- **No enterprise review service** — no persistent review queue, no multi-reviewer workflow, no escalation

## Possible Evolution

PENNY could evolve in several directions:

- **Application-specific governance subsystem** — a module within a larger dispatch-assist platform, enforcing transcript quality gates for this domain
- **Reusable platform governance capability** — a generalized trust-boundary pattern applicable to other contexts where fallible automated output requires human governance before operational use

The core responsibility — quality-gating ASR output before it influences operational decisions — persists regardless of deployment model.
