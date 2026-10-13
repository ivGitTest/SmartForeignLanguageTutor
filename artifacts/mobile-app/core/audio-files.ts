import type { AppData } from "./model";
const nativeOnly = () => { throw new Error("Recording and saved audio are available in the Android app. This browser is a screen preview."); };
export const audioFiles = {
  async freeSpace() { return Number.POSITIVE_INFINITY; },
  async keep(_uri: string, _duration: number): Promise<{ uri: string; duration: number; size: number; createdAt: number }> { return nativeOnly(); },
  async remove(_uri: string) { nativeOnly(); },
  async base64(_uri: string): Promise<string> { return nativeOnly(); },
  async recover(): Promise<AppData["pendingAudio"]> { return null; },
  async clearRecovery() {},
};
