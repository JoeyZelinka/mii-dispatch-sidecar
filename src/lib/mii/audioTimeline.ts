import type {
  AsrSegment,
  AudioTimelineMarker,
  AudioTranscriptAttachment,
  AudioWaveformPoint,
  IncidentContext,
} from './types';

// Pure, deterministic helpers for Phase 2D audio timeline/waveform provenance.
// Everything here is display-only. No randomness, no audio decoding, no network.
// These do NOT represent real audio content — they are demo provenance.

// Average spacing (seconds) used when precise timing is unavailable.
const FALLBACK_STEP_SECONDS = 2.5;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v));
}

function shortLabel(text: string, max = 42): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

// Estimate a clip duration from ASR segment end times. Returns undefined when
// there is nothing to estimate from.
export function estimateDurationFromSegments(segments: AsrSegment[]): number | undefined {
  if (!segments || segments.length === 0) return undefined;
  let maxEndMs = 0;
  for (const s of segments) {
    if (typeof s.endMs === 'number') maxEndMs = Math.max(maxEndMs, s.endMs);
    else if (typeof s.startMs === 'number') maxEndMs = Math.max(maxEndMs, s.startMs);
  }
  if (maxEndMs <= 0) return undefined;
  return round1(maxEndMs / 1000);
}

// Build a deterministic, display-only waveform for a given duration. Same input
// always yields byte-identical output (verification relies on this).
export function createDeterministicWaveform(
  durationSeconds: number,
  pointCount = 48
): AudioWaveformPoint[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const n = Math.max(2, Math.floor(pointCount));
  const points: AudioWaveformPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = round1((i / (n - 1)) * durationSeconds);
    // Combined fixed sine waves + a modular accent — deterministic, no Math.random.
    const raw =
      0.5 +
      0.3 * Math.sin(i * 0.6) +
      0.15 * Math.sin(i * 0.17 + 0.5) +
      (i % 5 === 0 ? 0.1 : 0);
    const amplitude = Math.round(clamp(0.1, 1, raw) * 1000) / 1000;
    points.push({ t, amplitude });
  }
  return points;
}

// ASR segments → timeline markers.
export function segmentsToTimelineMarkers(segments: AsrSegment[]): AudioTimelineMarker[] {
  if (!segments) return [];
  return segments.map((s, idx) => {
    const startSeconds =
      typeof s.startMs === 'number' ? round1(s.startMs / 1000) : round1(idx * FALLBACK_STEP_SECONDS);
    const endSeconds = typeof s.endMs === 'number' ? round1(s.endMs / 1000) : undefined;
    return {
      id: `mk_seg_${s.id}`,
      label: `${s.speaker}: ${shortLabel(s.text)}`,
      startSeconds,
      endSeconds,
      kind: 'ASR_SEGMENT',
      sourceId: s.id,
    };
  });
}

// Coarse transcript-line markers, used when no ASR segments are available.
export function transcriptAttachmentToMarkers(
  attachment: AudioTranscriptAttachment,
  durationSeconds?: number
): AudioTimelineMarker[] {
  const ids = attachment.transcriptLineIds ?? [];
  if (ids.length === 0) return [];
  const step =
    durationSeconds && durationSeconds > 0 ? durationSeconds / ids.length : FALLBACK_STEP_SECONDS;
  return ids.map((lineId, idx) => ({
    id: `mk_line_${lineId}`,
    label: `Line ${idx + 1}`,
    startSeconds: round1(idx * step),
    endSeconds: round1((idx + 1) * step),
    kind: 'TRANSCRIPT_LINE',
    sourceId: lineId,
  }));
}

// Compact, best-effort mapping of incident field provenance onto the timeline.
// Display-only and approximate — this never mutates incident logic.
const FIELD_LABELS: Record<string, string> = {
  address: 'Address',
  apartment: 'Apartment',
  natureCode: 'Nature',
  naturePlain: 'Nature',
  vehicle: 'Vehicle',
  plate: 'Plate',
  crossStreet: 'Cross St',
};

export function fieldProvenanceToTimelineMarkers(
  incident: IncidentContext,
  durationSeconds?: number
): AudioTimelineMarker[] {
  const markers: AudioTimelineMarker[] = [];
  const seenLabels = new Set<string>();
  const fields = incident.suggestedFields ?? [];
  const step =
    durationSeconds && durationSeconds > 0
      ? durationSeconds / Math.max(1, fields.length)
      : FALLBACK_STEP_SECONDS;

  fields.forEach((f, idx) => {
    const label = FIELD_LABELS[f.key];
    if (!label || seenLabels.has(label)) return;
    seenLabels.add(label);
    markers.push({
      id: `mk_fld_${f.id}`,
      label,
      startSeconds: round1(idx * step),
      kind: 'INCIDENT_FIELD',
      sourceId: f.id,
    });
  });

  // A responding unit is incident provenance too, even though it is not a field.
  if (incident.assignedUnits && incident.assignedUnits.length > 0) {
    markers.push({
      id: `mk_unit_${incident.id}`,
      label: 'Unit',
      startSeconds: round1(markers.length * step),
      kind: 'INCIDENT_FIELD',
      sourceId: incident.assignedUnits[0],
    });
  }

  return markers;
}
