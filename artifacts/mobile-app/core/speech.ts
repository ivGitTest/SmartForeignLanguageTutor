import * as Speech from "expo-speech";
let sequence = 0;
export function stopSpeaking() { sequence++; void Speech.stop(); }
export async function speak(text: string, onError?: (message: string) => void) {
  if (!text.trim()) return;
  const current = ++sequence;
  await Speech.stop();
  const voices = await Speech.getAvailableVoicesAsync();
  const english = voices.filter(v => /^en(?:[-_]|$)/i.test(v.language));
  const voice = english.find(v => !/-network$/i.test(v.identifier)) ?? english[0];
  if (!voice) throw new Error("No English system voice is available. Install an English text-to-speech voice in Android settings.");
  if (current !== sequence) return;
  const chunks: string[] = [];
  const limit = Math.min(3500, Speech.maxSpeechInputLength || 3500);
  let rest = text;
  while (rest) {
    let end = Math.min(limit, rest.length);
    if (end < rest.length) { const boundary = rest.lastIndexOf(" ", end); if (boundary > limit / 2) end = boundary; }
    chunks.push(rest.slice(0, end)); rest = rest.slice(end).trimStart();
  }
  function next(index: number) {
    if (current !== sequence || !chunks[index]) return;
    Speech.speak(chunks[index], {
      language: voice.language, voice: voice.identifier, rate: 0.9,
      onDone: () => next(index + 1), onStopped: () => { if (current === sequence) sequence++; },
      onError: () => { if (current === sequence) { sequence++; onError?.("English speech playback failed. Check your phone's speech engine and downloaded English voice."); } },
    });
  }
  next(0);
}
