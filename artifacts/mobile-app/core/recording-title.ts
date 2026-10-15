function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/** Stable, local-time title shared by the recording list and material detail. */
export function formatRecordingTitle(createdAt: number, durationSeconds: number): string {
  const date = new Date(createdAt);
  const datePart = `${twoDigits(date.getDate())}.${twoDigits(date.getMonth() + 1)}.${date.getFullYear()}`;
  const timePart = `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}:${twoDigits(date.getSeconds())}`;
  return `${datePart}/${timePart}/${Math.round(durationSeconds)}s`;
}

export function titleForMaterial(material: {
  createdAt: number;
  title: string;
  audio: { duration: number } | null;
}): string {
  return material.audio
    ? formatRecordingTitle(material.createdAt, material.audio.duration)
    : material.title;
}
