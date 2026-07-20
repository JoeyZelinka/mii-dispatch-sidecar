# DO NOT CLAIM — read before the meeting

These are statements that are **false or unprovable** from the code. Each has a **correct replacement** to say instead. When in doubt, describe the *concept* and admit the *implementation gap* — never round up.

---

### ❌ "The current code is production-scalable."
✅ **Say:** "Conceptually the contracts scale; at runtime it does not — it's a single-browser, in-memory prototype, and the runtime pieces get replaced, not tuned."

### ❌ "Local Whisper has been validated on real authorized radio traffic."
✅ **Say:** "Local Whisper is experimental. The model weights aren't even in the repo, and my tests never run the real inference. It proves on-device transcription is feasible in this shape — nothing about accuracy on real radio."

### ❌ "The audit export is cryptographically signed."
✅ **Say:** "It's an unkeyed SHA-256 checksum embedded in the file — local tamper-evidence, not a signature. There's no key, so it detects accidental changes, not a motivated attacker."

### ❌ "The audit mechanism provides legal chain of custody."
✅ **Say:** "It's tamper-evidence for a demo. Chain of custody needs a keyed signature, a trusted timestamp, an append-only external store, and real identity — none of which exist yet. The verify page says as much."

### ❌ "The application contains a live One Solution integration."
✅ **Say:** "There is no live CAD integration. It builds a payload object, redacts sensitive fields, and audits 'NOT SENT.' The field shape is a draft schema, nothing more."

### ❌ "The application is multi-tenant."
✅ **Say:** "Tenant and agency exist as schema fields but they're hardcoded constants with one global policy. The concept is there; the isolation isn't."

### ❌ "The verification harness is an end-to-end test suite."
✅ **Say:** "It's a 108-check domain regression harness — extraction, the state machines, gates, tamper-evidence, including failure paths. It doesn't test UI, store, persistence, real Whisper, or concurrency. It's not end-to-end."

### ❌ "The ASR job lifecycle represents true asynchronous distributed processing."
✅ **Say:** "It *models* the async lifecycle but runs synchronously, one step per call. No queue, no workers, no distribution. That's a Stage-4 replacement."

### ❌ "The prototype can support N radio channels / N concurrent users."
✅ **Say:** "I won't quote a capacity number — nothing in the code establishes one, and I haven't load-tested. Structurally it's single-session today."

### ❌ "MII_lite is the proposed Project Echo production architecture."
✅ **Say:** "MII_lite is a domain and workflow proof and a source of reusable contracts. It is not the proposed production architecture."

### ❌ "Human review can be bypassed safely."
✅ **Say:** "Review can't be bypassed — overrides without a note throw, and sign-off before issues are resolved throws. The guards are in the engine, not just the UI. What's missing is real reviewer identity."

### ❌ "The demo authentication represents production access control."
✅ **Say:** "It's a single shared static token with hardcoded fallbacks, and it doesn't even cover the audio route. It's a demo gate, not access control. Real authN/authZ is a Stage-9 replacement."

---

### Two more traps to avoid
- ❌ "The confidence scores show the model is accurate." ✅ "Confidence is fabricated for mocks and a placeholder for Whisper — it drives the review workflow, not a calibrated risk estimate."
- ❌ "The scenario replay is our recovery/replay capability." ✅ "That replay re-drives the deterministic engine to prove determinism. Operational replay would be event-log-based against a durable store."
