# Local Offline ASR Model Assets

Local ASR model files go **here**, under `public/models/`.

Model files are intentionally **not committed** to this repository (they are
large binaries and are excluded via `.gitignore`). Only this `README.md` and
`.gitkeep` are tracked.

## Why

Phase 3B adds an experimental, local/offline ASR provider
(`Local Offline Whisper (Experimental)`). It runs entirely in the browser using
Transformers.js against **local model assets only** — no cloud ASR, no external
upload, no server routes. Remote model downloading is disabled at runtime.

## Runtime requirement

Runtime local/offline ASR requires model files to be present. Expected layout:

```
public/models/Xenova/whisper-tiny.en/
  config.json
  tokenizer.json
  ... (Transformers.js ASR model files, incl. ONNX weights)
```

Without these files, `/audio` will detect the missing model and fail safely with
a clear message — the app still builds and the mock ASR / PENNY flows keep
working.

## How to install (locally, offline)

Download a compatible Transformers.js ASR model (e.g. `Xenova/whisper-tiny.en`)
and place its folder under `public/models/Xenova/whisper-tiny.en/`. Obtain the
files through an authorized, offline-appropriate method for your environment.

## Notes

- **Do not use unauthorized recordings.** Only process authorized original
  recordings.
- **First load/transcription can be slow** — the model is loaded and cached in
  the browser on first use.
- This is **experimental** and **not public-safety-grade** transcription. Human
  review and sign-off remain required before any transcript is attached or
  processed.
