'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  AlertTitle,
  TextField,
  MenuItem,
  Chip,
  Divider,
  Snackbar,
  Stack,
} from '@mui/material';
import Link from 'next/link';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import LinkIcon from '@mui/icons-material/Link';
import PlayForWorkIcon from '@mui/icons-material/PlayForWork';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import ClearIcon from '@mui/icons-material/Clear';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PageHeader from '@/components/PageHeader';
import AudioAssetCard, { formatBytes } from '@/components/AudioAssetCard';
import AsrResultCard from '@/components/AsrResultCard';
import AsrJobCard from '@/components/AsrJobCard';
import AudioTimelineCard from '@/components/AudioTimelineCard';
import PennyPlanCard from '@/components/PennyPlanCard';
import PennyReviewCard from '@/components/PennyReviewCard';
import DemoPolicyCard from '@/components/DemoPolicyCard';
import RecordingProcessingSessionCard from '@/components/RecordingProcessingSessionCard';
import {
  miiStore,
  createPlaceholderAudioAssetInput,
  useAudioAssets,
  useAudioTranscriptAttachments,
  useAsrTranscriptResults,
  useAsrJobs,
  usePennyPlans,
  usePennyTranscriptPackages,
  usePennyReviewStates,
  useDemoPolicy,
  useRecordingProcessingSessions,
  useIncidents,
} from '@/lib/mii/store';
import { SCENARIOS } from '@/lib/mii/seed';
import { ASR_PROVIDER_REGISTRY, getAsrProviderDefinition } from '@/lib/mii/asr/providerRegistry';
import { createDeterministicWaveform } from '@/lib/mii/audioTimeline';
import type { AsrProvider, AudioSourceType, HumanCheckpointKind } from '@/lib/mii/types';

const SOURCE_OPTIONS: { value: AudioSourceType; label: string }[] = [
  { value: 'SIMULATED_UPLOAD', label: 'Simulated Upload' },
  { value: 'AUTHORIZED_RECORDING', label: 'Authorized Recording' },
  { value: 'SYNTHETIC_TTS', label: 'Synthetic TTS' },
  { value: 'MANUAL_PLACEHOLDER', label: 'Manual Placeholder' },
  { value: 'BARIX_RECORDING', label: 'Barix-style Authorized Recording' },
];

// Scenario picker labels, mapped to the seeded scenario ids.
const SCENARIO_OPTIONS: { id: string; label: string }[] = [
  { id: 'medical-3-41', label: 'Medical 3-41' },
  { id: 'traffic-19', label: 'Traffic Stop 19' },
  { id: 'conflict-address', label: 'Address Conflict' },
  { id: 'admin-chatter', label: 'Admin Chatter' },
];

const ACCEPT = '.wav,.mp3,.m4a,.aac,.ogg,audio/*';

function seededTranscriptText(scenarioId: string): string {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) return '';
  return scenario.lines.map((l) => `${l.speaker}: ${l.text}`).join('\n');
}

export default function AudioClient() {
  const assets = useAudioAssets();
  const attachments = useAudioTranscriptAttachments();
  const asrResults = useAsrTranscriptResults();
  const asrJobs = useAsrJobs();
  const pennyPlans = usePennyPlans();
  const pennyPackages = usePennyTranscriptPackages();
  const pennyReviewStates = usePennyReviewStates();
  const demoPolicy = useDemoPolicy();
  const recordingSessions = useRecordingProcessingSessions();
  const incidents = useIncidents();

  const [sourceType, setSourceType] = React.useState<AudioSourceType>('SIMULATED_UPLOAD');
  const [notes, setNotes] = React.useState('');
  const [filePreview, setFilePreview] = React.useState<{ file: File; objectUrl: string } | null>(
    null
  );
  // Duration read locally from browser audio metadata for the pending file.
  const [pendingDurationSeconds, setPendingDurationSeconds] = React.useState<number | undefined>();

  const [activeAssetId, setActiveAssetId] = React.useState<string | undefined>();
  const [transcriptText, setTranscriptText] = React.useState('');
  const [attachScenarioId, setAttachScenarioId] = React.useState<string | undefined>();
  const [scenarioChoice, setScenarioChoice] = React.useState('medical-3-41');
  const [activeAttachmentId, setActiveAttachmentId] = React.useState<string | undefined>();

  // Optional ASR job shell state (Phase 2C).
  const [asrProvider, setAsrProvider] = React.useState<AsrProvider>('MOCK_SCENARIO');
  const [asrScenarioChoice, setAsrScenarioChoice] = React.useState('medical-3-41');
  const [asrFreeformText, setAsrFreeformText] = React.useState('');
  const [activeJobId, setActiveJobId] = React.useState<string | undefined>();

  // PENNY orchestrator state (Phase 2E).
  const [pennyProvider, setPennyProvider] = React.useState<AsrProvider>('MOCK_SCENARIO');
  const [pennyScenarioChoice, setPennyScenarioChoice] = React.useState('medical-3-41');
  const [pennyFreeformText, setPennyFreeformText] = React.useState('');
  const [activePennyPlanId, setActivePennyPlanId] = React.useState<string | undefined>();

  // Play-to-Process recording session state (Phase 3A).
  const [activeSessionId, setActiveSessionId] = React.useState<string | undefined>();

  const [toast, setToast] = React.useState<string | null>(null);

  // Blob URLs are session-local and not durable. They are used only for local
  // preview in Phase 2A. This ref tracks the one *unclaimed* preview URL (shown
  // in Step 2 before it is turned into an asset) so we can revoke it on replace,
  // clear, or unmount. Once a URL is handed to an asset its ownership transfers
  // and we stop tracking it here (we do not revoke persisted asset URLs).
  const previewUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const activeAsset = assets.find((a) => a.id === activeAssetId);
  const activeAttachment = attachments.find((a) => a.id === activeAttachmentId);
  const activeJob = asrJobs.find((j) => j.id === activeJobId);
  const providerDef = getAsrProviderDefinition(asrProvider);
  const jobIsTerminal =
    activeJob != null && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(activeJob.status);
  const activeJobResult =
    activeJob?.status === 'COMPLETED' && activeJob.resultId
      ? asrResults.find((r) => r.id === activeJob.resultId)
      : undefined;

  const pennyProviderDef = getAsrProviderDefinition(pennyProvider);
  const activePennyPlan = pennyPlans.find((p) => p.id === activePennyPlanId);
  const activePennyPackage = activePennyPlan?.transcriptPackageId
    ? pennyPackages.find((p) => p.id === activePennyPlan.transcriptPackageId)
    : undefined;
  const activePennyReviewState =
    activePennyPlan && activePennyPackage
      ? pennyReviewStates.find(
          (r) => r.planId === activePennyPlan.id && r.packageId === activePennyPackage.id
        )
      : undefined;
  const activePennyGate =
    activePennyPlan && activePennyPackage
      ? miiStore.pennyQualityGate(activePennyPlan.id, activePennyPackage.id)
      : undefined;
  const pennyPlanTerminalish =
    activePennyPlan != null && ['ATTACHED', 'CANCELLED'].includes(activePennyPlan.status);

  const activeSession = recordingSessions.find((s) => s.id === activeSessionId);
  const activeSessionAsset = activeSession
    ? assets.find((a) => a.id === activeSession.audioAssetId)
    : undefined;
  const showPlayToProcess =
    activeAsset?.sourceType === 'BARIX_RECORDING' || Boolean(activeSession);

  const eventNumberFor = (incidentId?: string) =>
    incidents.find((i) => i.id === incidentId)?.eventNumber;

  // Refresh + advance the active recording session after a human PENNY action.
  const syncActiveSession = (kind?: HumanCheckpointKind, summary?: string) => {
    if (!activeSessionId) return;
    miiStore.refreshRecordingProcessingSessionLinks(activeSessionId);
    if (kind) miiStore.markRecordingCheckpoint(activeSessionId, kind, summary);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Revoke the previous unclaimed preview before creating a new one.
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    // Local, session-only preview URL. The file itself is never uploaded.
    const objectUrl = URL.createObjectURL(f);
    previewUrlRef.current = objectUrl;
    setFilePreview({ file: f, objectUrl });
    setPendingDurationSeconds(undefined);

    // Read duration from local browser audio metadata only (no upload, no decode
    // of content). If unavailable, the flow still works without a duration.
    try {
      const probe = new Audio();
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => {
        const d = probe.duration;
        if (Number.isFinite(d) && d > 0) {
          setPendingDurationSeconds(Math.round(d * 10) / 10);
        }
      };
      probe.src = objectUrl;
    } catch {
      // Metadata probing is best-effort; ignore failures.
    }
  };

  const createAssetFromFile = () => {
    if (!filePreview) return;
    const { file, objectUrl } = filePreview;
    const durationSeconds = pendingDurationSeconds;
    const isBarix = sourceType === 'BARIX_RECORDING';
    const asset = miiStore.addAudioAsset({
      filename: file.name,
      sourceType,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      objectUrl,
      notes: notes.trim() || undefined,
      durationSeconds,
      waveform:
        durationSeconds && durationSeconds > 0
          ? createDeterministicWaveform(durationSeconds)
          : undefined,
      sourceLabel: isBarix ? 'Barix-style Authorized Recording' : undefined,
      sourceDevice: isBarix ? 'Demo Barix Source' : undefined,
      originalRecording: isBarix ? true : undefined,
      recordingProvenanceNote: isBarix
        ? 'Authorized original recording file provided for local demo processing.'
        : undefined,
    });
    setActiveAssetId(asset.id);
    setActiveAttachmentId(undefined);
    // Ownership of the blob URL transfers to the asset; stop tracking it here so
    // unmount/clear won't revoke the URL the asset card now renders.
    previewUrlRef.current = null;
    setFilePreview(null);
    setPendingDurationSeconds(undefined);
    setToast(`Audio asset created: ${asset.filename}`);
  };

  const createPlaceholder = () => {
    const asset = miiStore.addAudioAsset(
      createPlaceholderAudioAssetInput(notes.trim() || undefined)
    );
    setActiveAssetId(asset.id);
    setActiveAttachmentId(undefined);
    setToast('Manual placeholder audio asset created (18.0s fixture).');
  };

  const useSeededTranscript = () => {
    setTranscriptText(seededTranscriptText(scenarioChoice));
    setAttachScenarioId(scenarioChoice);
  };

  const requestJob = () => {
    if (!activeAssetId) return;
    const job = miiStore.requestAsrJob(activeAssetId, {
      provider: asrProvider,
      scenarioId: providerDef.supportsScenario ? asrScenarioChoice : undefined,
      freeformTranscriptText: providerDef.supportsFreeform ? asrFreeformText : undefined,
    });
    setActiveJobId(job.id);
    setToast(`ASR job requested (${providerDef.label}).`);
  };

  const advanceJob = () => {
    if (!activeJobId) return;
    const job = miiStore.advanceAsrJob(activeJobId);
    if (job) setToast(`ASR job → ${job.status}.`);
  };

  const runJobToCompletion = () => {
    if (!activeJobId) return;
    const job = miiStore.runAsrJobToCompletion(activeJobId);
    if (job) {
      setToast(
        job.status === 'COMPLETED'
          ? `ASR job completed (${job.events.length} lifecycle events).`
          : `ASR job ${job.status}${job.error ? `: ${job.error}` : ''}.`
      );
    }
  };

  const cancelJob = () => {
    if (!activeJobId) return;
    const job = miiStore.cancelAsrJob(activeJobId);
    if (job) setToast(`ASR job → ${job.status}.`);
  };

  // --- PENNY handlers ---
  const createPennyPlan = () => {
    if (!activeAssetId) return;
    const plan = miiStore.createPennyPlan({
      audioAssetId: activeAssetId,
      provider: pennyProvider,
      scenarioId: pennyProviderDef.supportsScenario ? pennyScenarioChoice : undefined,
      freeformTranscriptText: pennyProviderDef.supportsFreeform ? pennyFreeformText : undefined,
    });
    setActivePennyPlanId(plan.id);
    setToast('PENNY plan created.');
  };

  const pennyRequestJob = () => {
    if (!activePennyPlanId) return;
    const plan = miiStore.pennyRequestAsrJob(activePennyPlanId);
    if (plan) setToast(`PENNY → ${plan.status.replace(/_/g, ' ')}.`);
  };

  const pennyAdvance = () => {
    if (!activePennyPlanId) return;
    const plan = miiStore.pennyAdvanceAsrJob(activePennyPlanId);
    if (plan) setToast(`PENNY → ${plan.status.replace(/_/g, ' ')}.`);
  };

  const pennyRunToCompletion = () => {
    if (!activePennyPlanId) return;
    const plan = miiStore.pennyRunAsrToCompletion(activePennyPlanId);
    if (plan) setToast(`PENNY → ${plan.status.replace(/_/g, ' ')}.`);
  };

  const pennyEvaluate = () => {
    if (!activePennyPlanId) return;
    const pkg = miiStore.evaluateAsrResultForPenny(activePennyPlanId);
    if (pkg) {
      setToast(
        pkg.readyForAttachment
          ? 'PENNY review complete — transcript ready for attachment.'
          : 'PENNY review complete — transcript needs human review.'
      );
    }
  };

  const pennyAttach = () => {
    if (!activePennyPlanId) return;
    const attachment = miiStore.pennyAttachTranscriptPackage(activePennyPlanId);
    if (!attachment) {
      setToast('PENNY could not attach — transcript is not review-ready.');
      return;
    }
    setActiveAttachmentId(attachment.id);
    setTranscriptText(attachment.transcriptText);
    setAttachScenarioId(attachment.scenarioId);
    syncActiveSession('ATTACH_TRANSCRIPT', 'Reviewed transcript attached.');
    setToast('PENNY attached the reviewed transcript — process it in Step 4.');
  };

  // --- PENNY review handlers ---
  const pennyAcknowledge = (issueId: string, severity: 'INFO' | 'WARNING') => {
    if (!activePennyPlan || !activePennyPackage) return;
    miiStore.recordPennyReviewAction({
      planId: activePennyPlan.id,
      packageId: activePennyPackage.id,
      issueId,
      actionType: severity === 'WARNING' ? 'ACKNOWLEDGE_WARNING' : 'ACKNOWLEDGE_INFO',
    });
  };

  const pennyOverride = (issueId: string, note: string) => {
    if (!activePennyPlan || !activePennyPackage || !note.trim()) return;
    miiStore.recordPennyReviewAction({
      planId: activePennyPlan.id,
      packageId: activePennyPackage.id,
      issueId,
      actionType: 'OVERRIDE_BLOCKING',
      note,
    });
  };

  const pennyAddNote = (note: string) => {
    if (!activePennyPlan || !activePennyPackage || !note.trim()) return;
    miiStore.recordPennyReviewAction({
      planId: activePennyPlan.id,
      packageId: activePennyPackage.id,
      actionType: 'ADD_REVIEW_NOTE',
      note,
    });
  };

  const pennyEvaluateReadiness = () => {
    if (!activePennyPlan || !activePennyPackage) return;
    const rs = miiStore.evaluatePennyReviewReadiness(activePennyPlan.id, activePennyPackage.id);
    if (rs) {
      setToast(
        rs.readyForAttachment
          ? 'Review readiness evaluated — ready for attachment.'
          : 'Review readiness evaluated — still needs review.'
      );
    }
  };

  const pennySignOff = () => {
    if (!activePennyPlan || !activePennyPackage) return;
    try {
      const rs = miiStore.signOffPennyReview(activePennyPlan.id, activePennyPackage.id);
      if (rs?.signedOffBy) {
        syncActiveSession('REVIEW_TRANSCRIPT', 'Transcript reviewed.');
        syncActiveSession('SIGN_OFF_REVIEW', `Signed off by ${rs.signedOffBy}.`);
        setToast(`Review signed off by ${rs.signedOffBy}.`);
      }
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  const attachAsr = (asrResultId: string) => {
    const attachment = miiStore.attachAsrResultToAudio(asrResultId);
    if (!attachment) return;
    setActiveAttachmentId(attachment.id);
    // Mirror the attached transcript into the manual flow view for continuity.
    setTranscriptText(attachment.transcriptText);
    setAttachScenarioId(attachment.scenarioId);
    setToast('ASR transcript attached — ready to process in Step 4.');
  };

  const attachTranscript = () => {
    if (!activeAssetId || !transcriptText.trim()) return;
    const attachment = miiStore.attachTranscriptToAudio(
      activeAssetId,
      transcriptText,
      attachScenarioId
    );
    setActiveAttachmentId(attachment.id);
    setToast('Transcript attached to audio asset.');
  };

  const processAttachment = () => {
    if (!activeAttachmentId) return;
    const { incidentId } = miiStore.processAudioTranscriptAttachment(activeAttachmentId);
    syncActiveSession('PROCESS_INCIDENT', 'Attached transcript processed.');
    setToast(
      incidentId
        ? `Processed — incident ${eventNumberFor(incidentId) ?? incidentId} created/updated.`
        : 'Processed — no incident created (admin chatter or no incident-defining facts).'
    );
  };

  // --- Play-to-Process session handlers (Phase 3A) ---
  const createSession = () => {
    if (!activeAssetId) return;
    const s = miiStore.createRecordingProcessingSession({ audioAssetId: activeAssetId });
    setActiveSessionId(s.id);
    setToast('Play-to-Process session created.');
  };

  const playAndProcess = () => {
    if (!activeSession || !activeSessionAsset) return;
    // Local playback only (best-effort; requires the user gesture we already have).
    if (activeSessionAsset.objectUrl) {
      try {
        void new Audio(activeSessionAsset.objectUrl).play().catch(() => {});
      } catch {
        // ignore playback failures — Play-to-Process preparation still proceeds
      }
    }
    miiStore.startRecordingProcessingSession(activeSession.id);
    // Automated preparation via the selected mock ASR/PENNY path — no real ASR.
    const plan = miiStore.createPennyPlan({
      audioAssetId: activeSession.audioAssetId,
      provider: pennyProvider,
      scenarioId: pennyProviderDef.supportsScenario ? pennyScenarioChoice : undefined,
      freeformTranscriptText: pennyProviderDef.supportsFreeform ? pennyFreeformText : undefined,
    });
    setActivePennyPlanId(plan.id);
    miiStore.linkRecordingSessionToPennyPlan(activeSession.id, plan.id);
    miiStore.pennyRunAsrToCompletion(plan.id);
    miiStore.evaluateAsrResultForPenny(plan.id);
    miiStore.refreshRecordingProcessingSessionLinks(activeSession.id);
    setToast('Play & Process complete — awaiting human transcript review.');
  };

  const refreshSession = () => {
    if (!activeSessionId) return;
    miiStore.refreshRecordingProcessingSessionLinks(activeSessionId);
    setToast('Session links refreshed.');
  };

  const sessionCheckpoint = (kind: HumanCheckpointKind, summary?: string) => {
    if (!activeSessionId) return;
    miiStore.markRecordingCheckpoint(activeSessionId, kind, summary);
    setToast(`Checkpoint marked: ${kind.replace(/_/g, ' ')}.`);
  };

  const completeSession = () => {
    if (!activeSessionId) return;
    miiStore.completeRecordingProcessingSession(activeSessionId);
    setToast('Play-to-Process session completed.');
  };

  const cancelSession = () => {
    if (!activeSessionId) return;
    miiStore.cancelRecordingProcessingSession(activeSessionId);
    setToast('Play-to-Process session cancelled.');
  };

  const clearAll = () => {
    if (!window.confirm('Clear all audio assets and transcript attachments?')) return;
    // Revoke any live, unclaimed preview URL held by this component.
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    miiStore.clearAudioIntake();
    setActiveAssetId(undefined);
    setActiveAttachmentId(undefined);
    setActiveJobId(undefined);
    setActivePennyPlanId(undefined);
    setActiveSessionId(undefined);
    setTranscriptText('');
    setAttachScenarioId(undefined);
    setFilePreview(null);
    setPendingDurationSeconds(undefined);
  };

  const recentAssets = [...assets].reverse();
  const recentAttachments = [...attachments].reverse();
  const recentAsrResults = [...asrResults].reverse();
  const recentAsrJobs = [...asrJobs].reverse().slice(0, 4);
  const isAsrAttached = (asrResultId: string) =>
    attachments.some((a) => a.asrResultId === asrResultId);

  return (
    <Box>
      <PageHeader
        title="Recorded Audio Intake"
        subtitle="Phase 2A shell for attaching simulated or authorized recorded audio to transcript-first incident processing."
      />

      <Alert severity="warning" sx={{ mb: 2 }}>
        Simulated / Authorized Audio Only — no live radio, no real CAD, no agency systems, and no
        external APIs.
      </Alert>

      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>Phase 2A limitations</AlertTitle>
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          <li>Phase 2A does not transcribe audio automatically.</li>
          <li>The uploaded file is used only as a local browser preview and provenance artifact.</li>
          <li>The transcript text is what drives the MII pipeline in this phase.</li>
          <li>No audio file is uploaded to any service.</li>
          <li>Blob preview URLs are session-local and may disappear after refresh.</li>
        </Box>
      </Alert>

      <Card variant="outlined" sx={{ mb: 3, borderColor: 'primary.main' }}>
        <CardContent sx={{ py: 1.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Phase 2A Flow
          </Typography>
          <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
            <li>
              <Typography variant="body2" color="text.secondary">
                Create or select a simulated/authorized audio artifact.
              </Typography>
            </li>
            <li>
              <Typography variant="body2" color="text.secondary">
                Attach a seeded or manual transcript.
              </Typography>
            </li>
            <li>
              <Typography variant="body2" color="text.secondary">
                Process the transcript through the existing MII pipeline.
              </Typography>
            </li>
            <li>
              <Typography variant="body2" color="text.secondary">
                Review the resulting incident, safety gates, mock CAD payload, and audit log.
              </Typography>
            </li>
          </Box>
        </CardContent>
      </Card>

      {/* Step 1 — Select Audio Source */}
      <Typography variant="overline" color="text.secondary">
        Step 1 — Select Audio Source
      </Typography>
      <Card sx={{ mt: 1, mb: 3 }}>
        <CardContent>
          <TextField
            select
            label="Source type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as AudioSourceType)}
            sx={{ minWidth: 260 }}
            size="small"
          >
            {SOURCE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        </CardContent>
      </Card>

      {/* Step 2 — Add Audio */}
      <Typography variant="overline" color="text.secondary">
        Step 2 — Add Audio
      </Typography>
      <Card sx={{ mt: 1, mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ alignSelf: 'flex-start' }}>
              Choose audio file
              <input hidden type="file" accept={ACCEPT} onChange={handleFileChange} />
            </Button>

            {filePreview && (
              <Box sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ wordBreak: 'break-all' }}>
                  {filePreview.file.name}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, my: 1 }}>
                  <Chip size="small" variant="outlined" label={filePreview.file.type || 'unknown/type'} />
                  <Chip size="small" variant="outlined" label={formatBytes(filePreview.file.size)} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={
                      pendingDurationSeconds != null
                        ? `Duration: ${pendingDurationSeconds.toFixed(1)}s`
                        : 'Reading duration…'
                    }
                  />
                </Box>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio controls src={filePreview.objectUrl} style={{ width: '100%' }} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Preview is session-local only — the file is not uploaded anywhere.
                </Typography>
              </Box>
            )}

            <TextField
              label="Notes / provenance"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
              fullWidth
              size="small"
            />

            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
              <Button
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={createAssetFromFile}
                disabled={!filePreview}
              >
                Add Audio Asset
              </Button>
              <Button variant="outlined" startIcon={<NoteAddIcon />} onClick={createPlaceholder}>
                Create Manual Placeholder
              </Button>
            </Stack>

            {activeAsset && (
              <Alert severity="success" icon={false}>
                Active audio asset: <b>{activeAsset.filename}</b> ({activeAsset.status.replace(/_/g, ' ')})
              </Alert>
            )}

            {activeAsset && (
              <AudioTimelineCard
                asset={activeAsset}
                asrResult={activeJobResult}
                attachment={activeAttachment}
                compact
              />
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Play-to-Process — Barix-style Recording Intake (Phase 3A) */}
      {showPlayToProcess && (
        <>
          <Typography variant="overline" color="text.secondary">
            Play-to-Process — Barix-style Recording Intake
          </Typography>
          <Card sx={{ mt: 1, mb: 3, borderColor: 'primary.main', borderWidth: 1, borderStyle: 'solid' }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  End-to-end does not mean fully automatic. This flow starts automated preparation,
                  then stops at human checkpoints for transcript review, sign-off, attachment,
                  incident processing, safety gate review, Mock CAD submission, and audit export.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Play &amp; Process uses the selected mock ASR/PENNY path until Experimental Real ASR
                  is enabled. No real transcription occurs and no audio is uploaded.
                </Typography>

                {!activeSession ? (
                  <Button
                    variant="contained"
                    onClick={createSession}
                    disabled={!activeAssetId}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Create Play-to-Process Session
                  </Button>
                ) : (
                  <>
                    {activeSession.status === 'AWAITING_HUMAN_REVIEW' && (
                      <Alert severity="warning">
                        Human intervention required: review PENNY transcript quality and sign off
                        before attachment.
                      </Alert>
                    )}
                    {activeSession.status === 'REVIEW_SIGNED_OFF' && (
                      <Alert severity="info">
                        Human intervention required: attach the reviewed transcript.
                      </Alert>
                    )}
                    {activeSession.status === 'TRANSCRIPT_ATTACHED' && (
                      <Alert severity="info">
                        Human intervention required: process the attached transcript into incident
                        context.
                      </Alert>
                    )}
                    {activeSession.status === 'INCIDENT_PROCESSED' && (
                      <Alert severity="info">
                        Human intervention required: review Safety Gates before Mock CAD.
                      </Alert>
                    )}
                    <RecordingProcessingSessionCard
                      session={activeSession}
                      audioAsset={activeSessionAsset}
                      onStart={playAndProcess}
                      onRefresh={refreshSession}
                      onCompleteCheckpoint={sessionCheckpoint}
                      onCompleteSession={completeSession}
                      onCancel={cancelSession}
                    />
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        </>
      )}

      {/* Optional — Generate Transcript with ASR Job (Phase 2C) */}
      <Typography variant="overline" color="text.secondary">
        Optional — Generate Transcript with ASR Job
      </Typography>
      <Card sx={{ mt: 1, mb: 3, borderColor: 'info.main', borderWidth: 1, borderStyle: 'solid' }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Phase 2C simulates an asynchronous ASR lifecycle locally. It does not transcribe audio
              content. Mock providers generate ASR-shaped transcript results so the
              request/queue/transcribe/complete flow can be tested safely. No audio is uploaded and
              no external service is contacted.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Phase 2D adds local audio metadata and timeline provenance. Duration is read locally
              from browser audio metadata when available, or derived from deterministic mock ASR
              segments for demo fixtures. No audio is uploaded and no real ASR occurs.
            </Typography>

            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
              <TextField
                select
                label="ASR provider"
                value={asrProvider}
                onChange={(e) => setAsrProvider(e.target.value as AsrProvider)}
                size="small"
                sx={{ minWidth: 240 }}
              >
                {ASR_PROVIDER_REGISTRY.map((p) => (
                  <MenuItem key={p.provider} value={p.provider}>
                    {p.label}
                  </MenuItem>
                ))}
              </TextField>
              {providerDef.supportsScenario && (
                <TextField
                  select
                  label="Scenario"
                  value={asrScenarioChoice}
                  onChange={(e) => setAsrScenarioChoice(e.target.value)}
                  size="small"
                  sx={{ minWidth: 220 }}
                >
                  {SCENARIO_OPTIONS.map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>

            <Typography variant="caption" color="text.secondary">
              {providerDef.description}
            </Typography>

            {providerDef.supportsFreeform && (
              <TextField
                label="Freeform transcript input"
                value={asrFreeformText}
                onChange={(e) => setAsrFreeformText(e.target.value)}
                multiline
                minRows={3}
                fullWidth
                placeholder={'MDSO: You have a 3-41 at 210 174th Street Apartment 123.'}
              />
            )}

            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
              <Button
                variant="contained"
                color="info"
                startIcon={<GraphicEqIcon />}
                onClick={requestJob}
                disabled={
                  !activeAssetId || (providerDef.supportsFreeform && !asrFreeformText.trim())
                }
              >
                Request ASR Job
              </Button>
              <Button variant="outlined" onClick={advanceJob} disabled={!activeJob || jobIsTerminal}>
                Advance Job
              </Button>
              <Button
                variant="outlined"
                onClick={runJobToCompletion}
                disabled={!activeJob || jobIsTerminal}
              >
                Run Job to Completion
              </Button>
              <Button
                variant="outlined"
                color="warning"
                onClick={cancelJob}
                disabled={!activeJob || jobIsTerminal}
              >
                Cancel Job
              </Button>
            </Stack>

            {!activeAssetId && (
              <Typography variant="caption" color="text.secondary">
                Create an audio asset in Step 2 first.
              </Typography>
            )}

            {activeJob && (
              <AsrJobCard
                job={activeJob}
                filename={assets.find((a) => a.id === activeJob.audioAssetId)?.filename}
              />
            )}

            {activeJobResult && (
              <AsrResultCard
                result={activeJobResult}
                filename={assets.find((a) => a.id === activeJobResult.audioAssetId)?.filename}
              >
                <Button
                  variant="contained"
                  color="info"
                  startIcon={<LinkIcon />}
                  onClick={() => attachAsr(activeJobResult.id)}
                  disabled={isAsrAttached(activeJobResult.id)}
                >
                  {isAsrAttached(activeJobResult.id)
                    ? 'ASR Transcript Attached'
                    : 'Attach ASR Transcript to Audio'}
                </Button>
              </AsrResultCard>
            )}

            {activeJobResult && (
              <AudioTimelineCard
                asset={assets.find((a) => a.id === activeJobResult.audioAssetId)}
                asrResult={activeJobResult}
                attachment={activeAttachment}
              />
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Demo Policy (Phase 2I) */}
      <Typography variant="overline" color="text.secondary">
        Demo Policy
      </Typography>
      <Box sx={{ mt: 1, mb: 3 }}>
        <DemoPolicyCard policy={demoPolicy} onChangeMode={(mode) => miiStore.updateDemoPolicy(mode)} />
      </Box>

      {/* P.E.N.N.Y. — Transcription Orchestrator (Phase 2E) */}
      <Typography variant="overline" color="text.secondary">
        P.E.N.N.Y. — Transcription Orchestrator
      </Typography>
      <Card sx={{ mt: 1, mb: 3, borderColor: 'primary.main', borderWidth: 1, borderStyle: 'solid' }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              PENNY coordinates provider selection, ASR job lifecycle, transcript normalization,
              quality review, and readiness for attachment. PENNY does not perform real ASR, create
              incidents, or write to CAD.
            </Typography>

            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
              <TextField
                select
                label="ASR provider"
                value={pennyProvider}
                onChange={(e) => setPennyProvider(e.target.value as AsrProvider)}
                size="small"
                sx={{ minWidth: 240 }}
              >
                {ASR_PROVIDER_REGISTRY.map((p) => (
                  <MenuItem key={p.provider} value={p.provider}>
                    {p.label}
                  </MenuItem>
                ))}
              </TextField>
              {pennyProviderDef.supportsScenario && (
                <TextField
                  select
                  label="Scenario"
                  value={pennyScenarioChoice}
                  onChange={(e) => setPennyScenarioChoice(e.target.value)}
                  size="small"
                  sx={{ minWidth: 220 }}
                >
                  {SCENARIO_OPTIONS.map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>

            {pennyProviderDef.supportsFreeform && (
              <TextField
                label="Freeform transcript input"
                value={pennyFreeformText}
                onChange={(e) => setPennyFreeformText(e.target.value)}
                multiline
                minRows={3}
                fullWidth
                placeholder={'MDSO: You have a 3-41 at 210 174th Street Apartment 123.'}
              />
            )}

            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
              <Button
                variant="contained"
                onClick={createPennyPlan}
                disabled={
                  !activeAssetId || (pennyProviderDef.supportsFreeform && !pennyFreeformText.trim())
                }
              >
                Create PENNY Plan
              </Button>
              <Button variant="outlined" onClick={pennyRequestJob} disabled={!activePennyPlan || Boolean(activePennyPlan.asrJobId)}>
                Request ASR Job
              </Button>
              <Button variant="outlined" onClick={pennyAdvance} disabled={!activePennyPlan || pennyPlanTerminalish}>
                Advance Job
              </Button>
              <Button variant="outlined" onClick={pennyRunToCompletion} disabled={!activePennyPlan || pennyPlanTerminalish}>
                Run Job to Completion
              </Button>
              <Button
                variant="outlined"
                onClick={pennyEvaluate}
                disabled={
                  !activePennyPlan ||
                  (activePennyPlan.status !== 'ASR_COMPLETED' && activePennyPlan.status !== 'FAILED')
                }
              >
                Evaluate Transcript
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={pennyAttach}
                disabled={
                  activePennyPlan?.status === 'ATTACHED' ||
                  (activePennyGate
                    ? activePennyGate.status !== 'PASS'
                    : !activePennyPackage?.readyForAttachment) ||
                  Boolean(activePennyReviewState && !activePennyReviewState.signedOffBy)
                }
              >
                Attach Ready Transcript
              </Button>
            </Stack>

            {!activeAssetId && (
              <Typography variant="caption" color="text.secondary">
                Create an audio asset in Step 2 first.
              </Typography>
            )}

            {activePennyGate && activePennyGate.status !== 'PASS' && activePennyPlan?.status !== 'ATTACHED' && (
              <Typography variant="caption" color="text.secondary">
                Resolve PENNY review items below, then Evaluate Review Readiness before attaching.
              </Typography>
            )}

            {activePennyGate?.status === 'PASS' &&
              activePennyReviewState &&
              !activePennyReviewState.signedOffBy &&
              activePennyPlan?.status !== 'ATTACHED' && (
                <Typography variant="caption" color="text.secondary">
                  Sign off the review below before attaching the transcript.
                </Typography>
              )}

            {activePennyPlan && (
              <PennyPlanCard
                plan={activePennyPlan}
                pkg={activePennyPackage}
                reviewState={activePennyReviewState}
                qualityGate={activePennyGate}
                filename={assets.find((a) => a.id === activePennyPlan.audioAssetId)?.filename}
              />
            )}

            {activePennyPlan && activePennyPackage && activePennyGate && (
              <PennyReviewCard
                plan={activePennyPlan}
                pkg={activePennyPackage}
                reviewState={activePennyReviewState}
                gate={activePennyGate}
                onAcknowledgeIssue={(issueId) => {
                  const iss = activePennyPackage.qualityIssues.find((i) => i.id === issueId);
                  pennyAcknowledge(issueId, iss?.severity === 'WARNING' ? 'WARNING' : 'INFO');
                }}
                onOverrideIssue={pennyOverride}
                onAddNote={pennyAddNote}
                onEvaluateReadiness={pennyEvaluateReadiness}
                onSignOff={pennySignOff}
              />
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Step 3 — Attach Transcript */}
      <Typography variant="overline" color="text.secondary">
        Step 3 — Attach Transcript
      </Typography>
      <Card sx={{ mt: 1, mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
              <TextField
                select
                label="Seeded scenario"
                value={scenarioChoice}
                onChange={(e) => setScenarioChoice(e.target.value)}
                size="small"
                sx={{ minWidth: 220 }}
              >
                {SCENARIO_OPTIONS.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="outlined" onClick={useSeededTranscript}>
                Use Seeded Scenario Transcript
              </Button>
              {attachScenarioId && (
                <Chip size="small" color="primary" variant="outlined" label={`Seeded: ${attachScenarioId}`} />
              )}
            </Stack>

            <TextField
              label="Transcript (Speaker: text per line)"
              value={transcriptText}
              onChange={(e) => {
                setTranscriptText(e.target.value);
                // Manual edits switch this attachment to best-effort freeform mode.
                setAttachScenarioId(undefined);
              }}
              multiline
              minRows={6}
              fullWidth
              placeholder={'MDSO: Sunny Isles fifty.\nSIBPD: Sunny Isles fifty QSK.'}
            />

            <Button
              variant="contained"
              startIcon={<LinkIcon />}
              onClick={attachTranscript}
              disabled={!activeAssetId || !transcriptText.trim()}
              sx={{ alignSelf: 'flex-start' }}
            >
              Attach Transcript to Audio
            </Button>

            {!activeAssetId && (
              <Typography variant="caption" color="text.secondary">
                Create an audio asset in Step 2 first.
              </Typography>
            )}
            {activeAttachment && (
              <Alert severity="info" icon={false}>
                Transcript attached{activeAttachment.scenarioId ? ` (seeded: ${activeAttachment.scenarioId})` : ' (freeform)'} — ready to process.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Step 4 — Process Through MII Pipeline */}
      <Typography variant="overline" color="text.secondary">
        Step 4 — Process Through MII Pipeline
      </Typography>
      <Card sx={{ mt: 1, mb: 4 }}>
        <CardContent>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<PlayForWorkIcon />}
              onClick={processAttachment}
              disabled={!activeAttachmentId || Boolean(activeAttachment?.processedAt)}
            >
              Process Attached Transcript
            </Button>
            {activeAttachment?.processedAt && (
              <Chip size="small" color="success" label="Processed" />
            )}
            {activeAttachment?.activeIncidentId && (
              <Button
                component={Link}
                href={`/incidents/${activeAttachment.activeIncidentId}`}
                variant="outlined"
                startIcon={<OpenInNewIcon />}
              >
                See Incident Report
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Feature 7 — Audio intake list */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Recent Audio Assets
        </Typography>
        {(assets.length > 0 || attachments.length > 0) && (
          <Button color="error" size="small" startIcon={<ClearIcon />} onClick={clearAll}>
            Clear Audio Intake
          </Button>
        )}
      </Box>

      {recentAssets.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          No audio assets yet. Add one in Step 2.
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 2,
            mb: 4,
          }}
        >
          {recentAssets.map((asset) => {
            const att = attachments.find((a) => a.audioAssetId === asset.id && a.processedAt);
            return (
              <AudioAssetCard
                key={asset.id}
                asset={asset}
                linkedIncidentId={att?.activeIncidentId}
              />
            );
          })}
        </Box>
      )}

      {recentAttachments.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Transcript Attachments
          </Typography>
          <Card variant="outlined" sx={{ mb: 4 }}>
            <CardContent>
              {recentAttachments.map((att, idx) => {
                const asset = assets.find((a) => a.id === att.audioAssetId);
                const evNum = eventNumberFor(att.activeIncidentId);
                return (
                  <Box key={att.id}>
                    {idx > 0 && <Divider sx={{ my: 1.5 }} />}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle2" sx={{ wordBreak: 'break-all' }}>
                        {asset?.filename ?? att.audioAssetId}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={att.scenarioId ? `seeded: ${att.scenarioId}` : 'freeform'}
                      />
                      <Chip
                        size="small"
                        color={att.processedAt ? 'success' : 'default'}
                        label={att.processedAt ? 'processed' : 'attached'}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {att.transcriptLineIds.length} transcript line
                      {att.transcriptLineIds.length === 1 ? '' : 's'}
                      {att.processedAt ? '' : ' (not yet processed)'}
                      {att.activeIncidentId
                        ? ` · incident ${evNum ?? att.activeIncidentId}`
                        : att.processedAt
                          ? ' · no incident created'
                          : ''}
                    </Typography>
                    {att.activeIncidentId && (
                      <Button
                        component={Link}
                        href={`/incidents/${att.activeIncidentId}`}
                        size="small"
                        startIcon={<OpenInNewIcon />}
                        sx={{ mt: 0.5 }}
                      >
                        See Incident Report
                      </Button>
                    )}
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {recentAsrJobs.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Recent ASR Jobs
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2,
              mb: 4,
            }}
          >
            {recentAsrJobs.map((job) => (
              <AsrJobCard
                key={job.id}
                job={job}
                filename={assets.find((a) => a.id === job.audioAssetId)?.filename}
                compact
              >
                {!['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status) && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      miiStore.runAsrJobToCompletion(job.id);
                      setActiveJobId(job.id);
                    }}
                  >
                    Run to Completion
                  </Button>
                )}
                {job.status === 'COMPLETED' && job.resultId && (
                  <Button
                    size="small"
                    variant={isAsrAttached(job.resultId) ? 'outlined' : 'contained'}
                    color="info"
                    startIcon={<LinkIcon />}
                    onClick={() => job.resultId && attachAsr(job.resultId)}
                    disabled={isAsrAttached(job.resultId)}
                  >
                    {isAsrAttached(job.resultId) ? 'Attached' : 'Attach ASR Transcript'}
                  </Button>
                )}
              </AsrJobCard>
            ))}
          </Box>
        </>
      )}

      {recentAsrResults.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Recent ASR Results
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2,
              mb: 4,
            }}
          >
            {recentAsrResults.map((result) => {
              const attached = isAsrAttached(result.id);
              return (
                <AsrResultCard
                  key={result.id}
                  result={result}
                  filename={assets.find((a) => a.id === result.audioAssetId)?.filename}
                  compact
                >
                  {result.status === 'COMPLETED' && (
                    <Button
                      variant={attached ? 'outlined' : 'contained'}
                      color="info"
                      size="small"
                      startIcon={<LinkIcon />}
                      onClick={() => attachAsr(result.id)}
                      disabled={attached}
                    >
                      {attached ? 'Attached' : 'Attach ASR Transcript to Audio'}
                    </Button>
                  )}
                </AsrResultCard>
              );
            })}
          </Box>
        </>
      )}

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
