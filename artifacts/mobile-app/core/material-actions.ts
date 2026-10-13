import type { Repository } from "./repository";
import { operations as sharedOperations } from "./operations";
import { bFingerprint, bIsStale, translationFingerprint, id as newId, type Settings, type Material } from "./model";
type Client = Pick<typeof import("./openrouter"), "chat" | "transcribe">;
/** Injected boundaries make the complete AI chain testable without native modules or paid requests. */
export function createMaterialActions(repository: Repository, client: Client, operations = sharedOperations) {
const { chat, transcribe } = client;
function runTracked<T>(stage: "a" | "b" | "translation" | "context", label: string, id: string, work: (signal: AbortSignal, guard: () => void) => Promise<T>) {
  return operations.run(label, id, async (signal, guard) => {
    const attempt = newId();
    await repository.update(d => {
      guard();
      const m = d.materials.find(m => m.id === id);
      if (!m) throw new Error("This material has been deleted.");
      m.pendingAI = { id: attempt, stage, startedAt: Date.now() }; m.lastAIError = "";
    });
    try {
      const result = await work(signal, guard);
      await repository.update(d => { const m = d.materials.find(m => m.id === id); if (m?.pendingAI?.id === attempt) m.pendingAI = null; });
      return result;
    } catch (e) {
      await repository.update(d => {
        const m = d.materials.find(m => m.id === id);
        if (m?.pendingAI?.id === attempt) {
          m.pendingAI = null;
          m.lastAIError = signal.aborted ? "AI request interrupted. Previous results were kept; the provider may still bill it. Retry explicitly." : (e instanceof Error ? e.message.slice(0, 1000) : "AI request failed. No automatic retry.");
        }
      });
      throw e;
    }
  });
}
function current(id: string) {
  const d = repository.snapshot();
  const m = d.materials.find(m => m.id === id);
  if (!m) throw new Error("This material has been deleted.");
  if (!d.settings.consent) throw new Error("Open Settings and accept the data-transfer notice before using AI.");
  return { m: JSON.parse(JSON.stringify(m)) as Material, settings: JSON.parse(JSON.stringify(d.settings)) as Settings };
}
function check(draft: { materials: Material[] }, id: string, revision: number, guard: () => void) {
  guard();
  const m = draft.materials.find(m => m.id === id);
  if (!m || m.aRevision !== revision) throw new Error("The source changed or was deleted. The late result was not applied.");
  return m;
}
async function translateB(id: string, b: string, revision: number, settings: Settings, signal: AbortSignal, guard: () => void) {
  try {
    const result = await chat(settings.bModel, settings.translationPrompt, b, settings.translationParameters, signal, { sourceLanguage: "en", targetLanguage: settings.nativeLanguage, artifact: "B" });
    if (!result.complete) throw new Error("Translation was cut short. B is saved; retry Translation with a higher token limit.");
    await repository.update(d => {
      const m = check(d, id, revision, guard);
      if (m.b !== b) throw new Error("B changed. The late translation was not applied.");
      m.translation = result.text; m.translationFingerprint = translationFingerprint(settings); m.translationError = "";
      m.translationBVersion = m.bVersion; m.translationCreatedAt = Date.now();
      if (result.cost !== null) { m.cost += result.cost; m.costKnown = true; }
    });
  } catch (e) {
    if (!signal.aborted) await repository.update(d => {
      const m = check(d, id, revision, guard);
      if (m.b === b) m.translationError = e instanceof Error ? e.message.slice(0, 1000) : "Translation failed. B was saved.";
    });
    throw e;
  }
}
function generateA(id: string) {
  return runTracked("a", "Transcribing A", id, async (signal, guard) => {
    const { m, settings } = current(id);
    if (!m.audio) throw new Error("A can only be generated from saved audio.");
    const result = await transcribe(m.audio.uri, settings, signal);
    await repository.update(d => {
      const latest = check(d, id, m.aRevision, guard);
      if (!latest.audio || latest.audio.uri !== m.audio!.uri) throw new Error("The audio changed or was removed.");
      latest.a = result.text; latest.aRevision++; latest.aEdited = false;
      latest.aModelUsed = settings.aModel; latest.aCreatedAt = Date.now(); latest.aTemperatureUsed = settings.aTemperature;
      if (result.cost !== null) { latest.cost += result.cost; latest.costKnown = true; }
    });
  });
}
function generateB(id: string) {
  return runTracked("b", "Improving B · then translating", id, async (signal, guard) => {
    const { m, settings } = current(id);
    if (!m.a.trim()) throw new Error("Create or edit A first.");
    const result = await chat(settings.bModel, settings.bPrompt, m.a, settings.bParameters, signal, { sourceLanguage: settings.learningLanguage, sourceCEFR: "B1", targetCEFR: "B2", artifact: "A" });
    await repository.update(d => {
      const latest = check(d, id, m.aRevision, guard);
      if (result.cost !== null) { latest.cost += result.cost; latest.costKnown = true; }
      if (!result.complete) { latest.incomplete = result.text; return; }
      latest.b = result.text; latest.bARevision = m.aRevision; latest.bFingerprint = bFingerprint(settings);
      latest.bSourceA = m.a;
      latest.bVersion++;
      latest.bModelUsed = settings.bModel; latest.bCreatedAt = Date.now();
      if (latest.pendingAI) latest.pendingAI.stage = "translation";
      latest.translation = ""; latest.translationFingerprint = ""; latest.translationError = ""; latest.incomplete = "";
    });
    if (!result.complete) throw new Error("B was cut short. The incomplete attempt is shown separately; the previous B remains. Increase the token limit and retry.");
    guard();
    await translateB(id, result.text, m.aRevision, settings, signal, guard);
  });
}
function retryTranslation(id: string) {
  return runTracked("translation", "Translating B", id, async (signal, guard) => {
    const { m, settings } = current(id);
    if (!m.b || bIsStale(m, settings)) throw new Error("Create an up-to-date B before translating.");
    await translateB(id, m.b, m.aRevision, settings, signal, guard);
  });
}
function translateExpression(id: string, expression: string, sentence: string, expectedText: string, source: "a" | "b" = "b") {
  return runTracked("context", "Translating selected expression", id, async (signal, guard) => {
    const { m, settings } = current(id);
    const original = m[source];
    if (!original || original !== expectedText || (source === "b" && bIsStale(m, settings)) || !original.includes(sentence) || !sentence.includes(expression)) throw new Error("Select an expression in the current text.");
    if (!expression.trim() || expression.length > 500 || sentence.length > 10000) throw new Error("Select a shorter expression.");
    const result = await chat(settings.bModel, settings.contextPrompt, JSON.stringify({ expression, sentence }), settings.translationParameters, signal, { sourceLanguage: "en", targetLanguage: settings.nativeLanguage });
    guard();
    if (!result.complete || result.text.length > 2000) throw new Error("The contextual translation is incomplete or too long. Try again.");
    if (repository.snapshot().materials.find(m => m.id === id)?.[source] !== expectedText) throw new Error("The text changed. Select the expression again.");
    return result.text;
  });
}
return { generateA, generateB, retryTranslation, translateExpression };
}
