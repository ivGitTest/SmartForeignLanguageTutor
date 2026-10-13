/** Native timing may be unavailable while recording stops; one bad sample must not poison a valid one. */
export function recordingDuration(...samples: number[]): number {
  const valid = samples.filter(value => Number.isFinite(value) && value > 0);
  return valid.length ? Math.min(120, Math.max(...valid)) : NaN;
}

export class RecordingDurationError extends Error {
  constructor() {
    super("Recording duration is unavailable [RECORDING_DURATION_UNAVAILABLE]. The source file was not deleted, but it is not safely saved. Keep this screen open and contact the developer.");
  }
}
