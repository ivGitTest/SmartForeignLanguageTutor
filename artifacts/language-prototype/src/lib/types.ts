import type { AiParameters, RewriteResult, TranscriptResult } from '@workspace/api-client-react';

export type Level = 'B2' | 'C1';

export interface Settings {
  schemaVersion: 1;
  instruction: string;
  parameters: AiParameters;
  transcriptionTemperature: number;
  /** Increments only when the instruction or B parameters change. */
  revision: number;
  defaultsVersion: string;
}

export interface RecordingRec {
  id: string;
  createdAt: string;
  blob: Blob;
  mime: string;
  durationMs: number;
}

export interface WorkState {
  transcript: TranscriptResult | null;
  editable: { text: string; revision: number };
  results: { B2?: RewriteResult; C1?: RewriteResult };
}

export interface Draft {
  instruction: string;
  temperature: string;
  topP: string;
  maxTokens: string;
  seed: string;
  tempA: string;
}
