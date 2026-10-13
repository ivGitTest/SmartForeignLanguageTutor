import { Directory, File, Paths } from "expo-file-system";
import { id } from "./model";
const folder = new Directory(Paths.document, "recordings");
const marker = new File(folder, "pending.json");
const prefix = (uri: string) => uri.replace(/\/?$/, "/");
export const audioFiles = {
  async freeSpace() { return Paths.availableDiskSpace; },
  async keep(uri: string, duration: number) {
    const file = new File(uri);
    if (!file.exists || !file.size || file.size > 10 * 1024 * 1024 || duration < 0.3 || duration > 120.5) {
      if (file.exists) file.delete();
      throw new Error("Recording must be 0.3–120 seconds and no larger than 10 MiB.");
    }
    folder.create({ idempotent: true, intermediates: true });
    const target = new File(folder, `recording-${id()}.m4a`);
    file.move(target);
    const draft = { uri: target.uri, duration, size: target.size, createdAt: Date.now() };
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
    const value = JSON.parse(await marker.text());
    if (typeof value.uri !== "string" || !value.uri.startsWith(prefix(folder.uri)) || !new File(value.uri).exists) { marker.delete(); return null; }
    return value;
  },
  async clearRecovery() { if (marker.exists) marker.delete(); },
};
