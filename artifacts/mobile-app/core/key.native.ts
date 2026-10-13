import * as SecureStore from "expo-secure-store";
const KEY = "smart-lang-tutor-openrouter";
let tail: Promise<unknown> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const pending = tail.then(work);
  tail = pending.catch(() => {});
  return pending;
}
async function available() {
  if (!(await SecureStore.isAvailableAsync())) throw new Error("Protected storage is unavailable. The key was not saved.");
}
export const keyStorage = {
  async has() { await tail; await available(); return !!(await SecureStore.getItemAsync(KEY)); },
  async readForRequest() { await tail; await available(); const value = await SecureStore.getItemAsync(KEY); if (!value) throw new Error("Connect your OpenRouter key in Settings."); return value; },
  save(value: string, signal?: AbortSignal) { return serialized(async () => {
    await available();
    if (signal?.aborted) throw new Error("Key connection cancelled.");
    const previous = await SecureStore.getItemAsync(KEY);
    await SecureStore.setItemAsync(KEY, value);
    if (signal?.aborted) {
      if (previous) await SecureStore.setItemAsync(KEY, previous); else await SecureStore.deleteItemAsync(KEY);
      throw new Error("Key connection cancelled.");
    }
  }); },
  remove() { return serialized(async () => { await available(); await SecureStore.deleteItemAsync(KEY); }); },
};
