// Phase 3B — local browser audio decode/resample for offline ASR input.
// Client/browser only; no upload, no server APIs. Produces mono Float32 PCM.

const DEFAULT_TARGET_SAMPLE_RATE = 16000;

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  );
}

export async function blobToMonoFloat32Pcm(
  blob: Blob,
  targetSampleRate: number = DEFAULT_TARGET_SAMPLE_RATE
): Promise<{ samples: Float32Array; sampleRate: number; durationSeconds: number }> {
  const Ctor = getAudioContextCtor();
  if (!Ctor) {
    throw new Error('Audio decoding is only available in the browser.');
  }

  const arrayBuffer = await blob.arrayBuffer();

  // Decode with a short-lived AudioContext.
  const decodeCtx = new Ctor();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    await decodeCtx.close().catch(() => {});
    throw new Error('The browser could not decode this audio file.');
  }
  await decodeCtx.close().catch(() => {});

  // Mix down to mono.
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  for (let c = 0; c < channels; c += 1) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i += 1) mono[i] += data[i] / channels;
  }

  const sourceRate = audioBuffer.sampleRate;
  if (sourceRate === targetSampleRate) {
    return {
      samples: mono,
      sampleRate: sourceRate,
      durationSeconds: length / sourceRate,
    };
  }

  // Resample to the target rate via OfflineAudioContext.
  const OfflineCtor =
    (typeof window !== 'undefined' &&
      (window.OfflineAudioContext ??
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
          .webkitOfflineAudioContext)) ||
    undefined;

  if (!OfflineCtor) {
    // No resampler available — return source-rate mono; the caller/model can
    // still attempt transcription, but 16k is preferred.
    return { samples: mono, sampleRate: sourceRate, durationSeconds: length / sourceRate };
  }

  const targetLength = Math.max(1, Math.round((length * targetSampleRate) / sourceRate));
  const offline = new OfflineCtor(1, targetLength, targetSampleRate);
  const monoBuffer = offline.createBuffer(1, length, sourceRate);
  monoBuffer.copyToChannel(mono, 0);
  const src = offline.createBufferSource();
  src.buffer = monoBuffer;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  const resampled = rendered.getChannelData(0);

  return {
    samples: new Float32Array(resampled),
    sampleRate: targetSampleRate,
    durationSeconds: targetLength / targetSampleRate,
  };
}
