import type { CodeEntry } from './types';

// Local plain-talk / Q-code dictionary. Deterministic, no external lookups.
export const CODE_DICTIONARY: CodeEntry[] = [
  {
    code: '3-41',
    meaning: 'Sick or injured person',
    type: 'Signal',
    notes: 'Medical call. Often dispatched with patient age/sex and complaint.',
  },
  {
    code: '41',
    meaning: 'Sick or injured person',
    type: 'Signal',
    notes: 'Short form of 3-41.',
  },
  {
    code: '19',
    meaning: 'Traffic stop / traffic violation',
    type: 'Signal',
    notes: 'Often officer-initiated. May carry vehicle + plate (sensitive).',
  },
  {
    code: 'QSK',
    meaning: 'Proceed with transmission / go ahead',
    type: 'Q-Code',
    notes: 'Protocol token. Invites the other party to continue.',
  },
  {
    code: 'QSL',
    meaning: 'Acknowledge / affirmative',
    type: 'Q-Code',
    notes: 'Protocol token. Readback/confirmation — boosts confidence, no new incident.',
  },
  {
    code: 'en route',
    meaning: 'Unit en route',
    type: 'Plain-Talk',
    notes: 'Unit status cue → EN_ROUTE.',
  },
  {
    code: 'arrival',
    meaning: 'Unit arrived',
    type: 'Plain-Talk',
    notes: 'Unit status cue → ARRIVED.',
  },
];

const BY_CODE: Record<string, CodeEntry> = CODE_DICTIONARY.reduce(
  (acc, entry) => {
    acc[entry.code.toLowerCase()] = entry;
    return acc;
  },
  {} as Record<string, CodeEntry>
);

export function lookupCode(code: string): CodeEntry | undefined {
  return BY_CODE[code.trim().toLowerCase()];
}

export function translateSignal(code: string): string | undefined {
  return lookupCode(code)?.meaning;
}
