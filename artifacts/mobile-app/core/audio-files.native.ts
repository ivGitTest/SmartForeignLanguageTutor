import { Directory, File, Paths } from "expo-file-system";
import { id } from "./model";
import { isValidRecordingFileSize, repairPendingAudioMetadata } from "./recording-metadata";
const folder = new Directory(Paths.document, "recordings");
const marker = new File(folder, "pending.json");
const prefix = (uri: string) => uri.replace(/\/?$/, "/");
export const audioFiles = {
  async freeSpace() { return Paths.availableDiskSpace; },
  async keep(uri: string, duration: number) {
    const file = new File(uri);
    if (!file.exists) throw new Error("Recording file is missing.");
    const size = file.size;
    if (!isValidRecordingFileSize(size) || !Number.isFinite(duration) || duration < 0.3 || duration > 120.5) {
      if (file.exists) file.delete();
      throw new Error("Recording must be 0.3–120 seconds and no larger than 10 MiB.");
    }
    folder.create({ idempotent: true, intermediates: true });
    const target = new File(folder, `recording-${id()}.m4a`);
    file.move(target);
    // Keep the validated source size. A destination stat immediately after move can be stale on Android.
    const draft = { uri: target.uri, duration, size, createdAt: Date.now() };
    marker.write(JSON.stringify(draft));
    return draft;
  },
  async remove(uri: string) {
    const file = new File(uri);
    // Never delete arbitrary paths supplied by external data.
    if (!uri.startsWith(prefix(folder.uri)) && !uri.startsWith(prefix(Paths.cache.uri))) throw new Error("Invalid recording location.");
    if (file.exists) file.delete();
  },
  async base64(uri: string) {
    if (!uri.startsWith(prefix(folder.uri))) throw new Error("Invalid recording location.");
    const file = new File(uri);
    if (!file.exists) throw new Error("Recording file is missing.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Recording exceeds 10 MiB.");
    return file.base64();
  },
  async recover() {
    if (!marker.exists) return null;
    const value: unknown = JSON.parse(await marker.text());
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      marker.delete();
      return null;
    }
    const markerValue = value as Record<string, unknown>;
    if (typeof markerValue.uri !== "string" || !markerValue.uri.startsWith(prefix(folder.uri))) {
      marker.delete();
      return null;
    }
    const file = new File(markerValue.uri);
    if (!file.exists) { marker.delete(); return null; }
    const recovered = repairPendingAudioMetadata(markerValue, file.size);
    if (!recovered) throw new Error("Temporary recording metadata is invalid; the file and recovery marker were retained.");
    if (markerValue.size !== recovered.size) marker.write(JSON.stringify(recovered));
    return recovered;
  },
  async clearRecovery() { if (marker.exists) marker.delete(); },
};
