'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Alert,
  AlertTitle,
  Divider,
  Stack,
} from '@mui/material';
import Link from 'next/link';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ClearIcon from '@mui/icons-material/Clear';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { miiStore, useReplay, useIncidents, useTranscriptLines } from '@/lib/mii/store';
import {
  DEMO_SCENARIO_ORDER,
  DEMO_TITLES,
  SCENARIO_PURPOSE,
  WHAT_TO_WATCH,
  explainLine,
} from '@/lib/mii/demoContent';
import { submitBlockReasons } from '@/lib/mii/safetyGates';
import type { IncidentContext } from '@/lib/mii/types';
import PageHeader from '@/components/PageHeader';
import PatentMappingCard from '@/components/PatentMappingCard';
import { SemanticBadge, CueChip, IncidentStatusChip } from '@/components/StatusChip';
import { formatTime } from '@/lib/format';

const REPLAY_DELAY_MS = 1800;

export default function DemoClient() {
  const replay = useReplay();
  const incidents = useIncidents();
  const lines = useTranscriptLines();

  const [selectedId, setSelectedId] = React.useState<string>('medical-3-41');
  const [results, setResults] = React.useState<Record<string, string>>({});
  const [playing, setPlaying] = React.useState(false);

  // Delayed replay ticker — steps one line at a time via the same engine path.
  React.useEffect(() => {
    if (!playing) return;
    if (!replay || replay.completed) {
      setPlaying(false);
      return;
    }
    const t = setInterval(() => miiStore.stepReplay(), REPLAY_DELAY_MS);
    return () => clearInterval(t);
  }, [playing, replay?.completed, replay?.scenarioId]);

  // Capture the incident produced by a replay so "See Incident Report" can link.
  React.useEffect(() => {
    if (replay?.activeIncidentId) {
      const sid = replay.scenarioId;
      const iid = replay.activeIncidentId;
      setResults((prev) => (prev[sid] === iid ? prev : { ...prev, [sid]: iid }));
    }
  }, [replay?.activeIncidentId, replay?.scenarioId]);

  const needsFreshReplay = (id: string) =>
    !replay || replay.scenarioId !== id || replay.completed;

  const startLineByLine = () => {
    setPlaying(false);
    miiStore.startReplay(selectedId);
  };

  const stepNext = () => {
    if (needsFreshReplay(selectedId)) miiStore.startReplay(selectedId);
    miiStore.stepReplay();
  };

  const replayWithDelay = () => {
    if (needsFreshReplay(selectedId)) miiStore.startReplay(selectedId);
    setPlaying(true);
  };

  const pause = () => setPlaying(false);

  const clearReplay = () => {
    setPlaying(false);
    miiStore.clearReplay();
  };

  const selectedTitle = DEMO_TITLES[selectedId] ?? selectedId;
  const replayIncident = incidents.find((i) => i.id === replay?.activeIncidentId);

  return (
    <Box>
      <PageHeader
        title="Guided Demo"
        subtitle="A self-guided walkthrough of MII_lite’s dispatch intelligence, safety gates, and audit/provenance model."
      />

      <Alert severity="warning" sx={{ mb: 2 }}>
        Simulated Data Only — no real radio, CAD, agency systems, or external APIs.
      </Alert>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        <Link href="/audio" style={{ color: 'inherit' }}>
          Audio Intake
        </Link>{' '}
        now includes PENNY, a deterministic transcription orchestrator that prepares ASR-shaped
        transcripts for review and attachment. Real ASR is not enabled.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>How to use this demo</AlertTitle>
        <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
          <li>Select a scenario card.</li>
          <li>
            Use <b>Replay with delay</b> for the easiest walkthrough, or <b>Replay line-by-line</b> +{' '}
            <b>Step next line</b> for manual control.
          </li>
          <li>Watch the Live Demo Feed explain each transcript line.</li>
          <li>
            Use <b>See Incident Report</b> to review Safety Gates, mock CAD payload, audit, sensitive
            fields, or conflicts.
          </li>
        </Box>
      </Alert>

      {/* Step 1 — Select a scenario */}
      <Typography variant="overline" color="text.secondary">
        Step 1 — Select a scenario
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2,
          mt: 1,
          mb: 3,
        }}
      >
        {DEMO_SCENARIO_ORDER.map((id) => {
          const selected = id === selectedId;
          const resultId = results[id];
          const isAdmin = id === 'admin-chatter';
          return (
            <Card
              key={id}
              onClick={() => setSelectedId(id)}
              sx={{
                cursor: 'pointer',
                borderColor: selected ? 'primary.main' : undefined,
                borderWidth: selected ? 2 : 1,
                borderStyle: 'solid',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    {DEMO_TITLES[id]}
                  </Typography>
                  {selected && <Chip size="small" color="primary" label="Selected" />}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {SCENARIO_PURPOSE[id]}
                </Typography>
                <Typography variant="overline" color="text.secondary">
                  What to watch
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {WHAT_TO_WATCH[id].map((w) => (
                    <li key={w}>
                      <Typography variant="body2" color="text.secondary">
                        {w}
                      </Typography>
                    </li>
                  ))}
                </Box>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2, gap: 1, flexWrap: 'wrap' }}>
                {isAdmin ? (
                  <Chip variant="outlined" label="Expected result: no incident created" />
                ) : resultId ? (
                  <Button
                    component={Link}
                    href={`/incidents/${resultId}`}
                    variant="contained"
                    startIcon={<OpenInNewIcon />}
                    onClick={(e) => e.stopPropagation()}
                  >
                    See Incident Report
                  </Button>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Run a replay to generate the incident report.
                  </Typography>
                )}
              </CardActions>
            </Card>
          );
        })}
      </Box>

      {/* Step 2 — Run the replay */}
      <Typography variant="overline" color="text.secondary">
        Step 2 — Run the replay
      </Typography>
      <Card sx={{ mt: 1, mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Replay Controls
            </Typography>
            <Chip size="small" variant="outlined" label={`Scenario: ${selectedTitle}`} />
          </Box>
          <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap', gap: 1.25 }}>
            <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={replayWithDelay} disabled={playing}>
              Replay with delay
            </Button>
            <Button variant="outlined" startIcon={<PlayCircleIcon />} onClick={startLineByLine}>
              Replay line-by-line
            </Button>
            <Button variant="outlined" startIcon={<SkipNextIcon />} onClick={stepNext}>
              Step next line
            </Button>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<PauseIcon />}
              onClick={pause}
              disabled={!playing}
            >
              Pause
            </Button>
            <Button variant="outlined" color="error" startIcon={<ClearIcon />} onClick={clearReplay}>
              Clear replay
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Step 3 + 4 — Live feed and patent mapping */}
      <Typography variant="overline" color="text.secondary">
        Step 3 — Watch the Live Demo Feed · Step 4 — Review Patent Mapping
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' },
          gap: 2,
          mt: 1,
          alignItems: 'start',
        }}
      >
        <LiveDemoFeed replayIncident={replayIncident} lines={lines} replay={replay} playing={playing} />
        <PatentMappingCard scenarioId={selectedId} scenarioTitle={selectedTitle} />
      </Box>
    </Box>
  );
}

function LiveDemoFeed({
  replay,
  replayIncident,
  lines,
  playing,
}: {
  replay: ReturnType<typeof useReplay>;
  replayIncident?: IncidentContext;
  lines: ReturnType<typeof useTranscriptLines>;
  playing: boolean;
}) {
  if (!replay) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Live Demo Feed
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Start a line-by-line, stepped, or delayed replay to see each transcript line processed
            with its cues, semantic type, and a short explanation.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const processed = replay.processedLineIds
    .map((id) => lines.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));
  const blockReasons = replayIncident ? submitBlockReasons(replayIncident) : [];
  const statusLabel = replay.completed ? 'Completed' : playing ? 'Playing' : 'Ready';

  return (
    <Card sx={{ borderColor: 'primary.main', borderWidth: 1, borderStyle: 'solid' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Live Demo Feed
          </Typography>
          <Chip
            size="small"
            color={replay.completed ? 'success' : playing ? 'info' : 'default'}
            label={statusLabel}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <Chip size="small" variant="outlined" label={replay.scenarioTitle} />
          <Chip
            size="small"
            variant="outlined"
            label={`Line ${replay.currentLineIndex} of ${replay.totalLines}`}
          />
          {replayIncident ? (
            <>
              <Chip size="small" variant="outlined" label={replayIncident.eventNumber} />
              <IncidentStatusChip status={replayIncident.status} />
            </>
          ) : (
            <Chip size="small" variant="outlined" label="No incident yet" />
          )}
        </Box>

        {replayIncident && (
          <Alert severity={blockReasons.length ? 'warning' : 'success'} sx={{ mb: 1.5 }}>
            {blockReasons.length ? (
              <>
                <b>Mock CAD blocked:</b> {blockReasons.join(' · ')}
              </>
            ) : (
              <>All blocking safety gates pass — mock CAD submission allowed.</>
            )}
          </Alert>
        )}

        <Divider sx={{ mb: 1 }} />

        {processed.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Replay armed. Use “Step next line” or “Replay with delay” to begin processing.
          </Typography>
        ) : (
          processed.map((line, idx) => {
            const explanations = explainLine(line, replayIncident);
            return (
              <Box key={line.id}>
                {idx > 0 && <Divider sx={{ my: 1 }} />}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip size="small" variant="outlined" color="primary" label={line.speaker} />
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(line.timestamp)}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  {line.semanticType && <SemanticBadge type={line.semanticType} />}
                </Box>
                <Typography variant="body1" sx={{ my: 0.5 }}>
                  “{line.text}”
                </Typography>
                {line.cueEvents.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                    {line.cueEvents.map((c) => (
                      <CueChip key={c.id} cueType={c.cueType} phrase={c.phrase} />
                    ))}
                  </Box>
                )}
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {explanations.map((e) => (
                    <li key={e}>
                      <Typography variant="caption" color="text.secondary">
                        {e}
                      </Typography>
                    </li>
                  ))}
                </Box>
              </Box>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
