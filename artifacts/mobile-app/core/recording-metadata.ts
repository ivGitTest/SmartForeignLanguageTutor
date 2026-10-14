import {
  MAX_RECORDING_SIZE_BYTES,
  pendingAudioSchema,
  type PendingAudio,
} from "./model";

/** Native timing may be unavailable while recording stops; one bad sample must not poison a valid one. */
export function recordingDuration(...samples: number[]): number {
  const valid = samples.filter(value => Number.isFinite(value) && value > 0);
  return valid.length ? Math.min(120, Math.max(...valid)) : NaN;
}

export function isValidRecordingFileSize(size: unknown): size is number {
  return typeof size === "number"
    && Number.isSafeInteger(size)
    && size >= 1
    && size <= MAX_RECORDING_SIZE_BYTES;
}

/** Rebuild recovery metadata from the retained file's current stat, not a stale marker size. */
export function repairPendingAudioMetadata(value: unknown, actualSize: unknown): PendingAudio | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = pendingAudioSchema.safeParse({
    ...(value as Record<string, unknown>),
    size: actualSize,
  });
  return result.success ? result.data : null;
}

export class RecordingDurationError extends Error {
  constructor() {
    super("Recording duration is unavailable [RECORDING_DURATION_UNAVAILABLE]. The source file was not deleted, but it is not safely saved. Keep this screen open and contact the developer.");
  }
}
