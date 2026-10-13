import { fetch } from "expo/fetch";
import { A_MODELS, B_MODELS, type Settings, type Parameters } from "./model";
import { keyStorage } from "./key";
import { audioFiles } from "./audio-files";
import { APP_NAME } from "../constants/app";

const ORIGIN = "https://openrouter.ai";
const PATHS = new Set(["/api/v1/key", "/api/v1/models", "/api/v1/models?output_modalities=transcription", "/api/v1/audio/transcriptions", "/api/v1/chat/completions"]);
export type ModelInfo = { id: string; pricing: Record<string, string>; supported_parameters: string[]; contextLength: number };
export type Catalog = { at: number; models: ModelInfo[] };
let catalog: Catalog | null = null;
const messages: Record<number, string> = {
  400: "The model rejected the request or parameters. Check AI settings.",
  401: "OpenRouter rejected the key. Replace it in Settings.",
  402: "The OpenRouter key has insufficient funds or has reached its budget.",
  403: "This key or provider does not allow the request.",
  404: "The selected model or endpoint is unavailable. Select another permitted model.",
  413: "The recording is too large for the selected provider.",
  422: "The provider rejected the audio format or request parameters.",
  429: "Rate limit reached. Wait before trying again.",
  502: "The selected provider is temporarily unavailable.",
  503: "No provider is currently available for this model and these parameters.",
};
async function request(path: string, signal: AbortSignal, body?: object, candidate?: string, authenticated = true) {
  if (!PATHS.has(path)) throw new Error("API endpoint is not permitted.");
  const local = new AbortController();
  let timedOut = false;
  const abort = () => local.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) local.abort();
  const timer = setTimeout(() => { timedOut = true; local.abort(); }, 60000);
  let credential: string | undefined;
  try {
    if (authenticated) {
      try { credential = candidate ?? await keyStorage.readForRequest(); }
      catch (e) { throw new ProviderError(e instanceof Error && e.message.startsWith("Connect your") ? e.message : "Protected API-key storage is unavailable. No insecure fallback is used."); }
    }
    if (local.signal.aborted) throw new Error("Cancelled");
    const response = await fetch(ORIGIN + path, {
      method: body ? "POST" : "GET", redirect: "error", signal: local.signal,
      headers: { ...(credential ? { Authorization: `Bearer ${credential}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}), "X-OpenRouter-Title": APP_NAME },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new ProviderError(messages[response.status] ?? `OpenRouter could not complete the request (HTTP ${response.status}).`);
    if (response.redirected || !response.url.startsWith(ORIGIN + "/")) throw new ProviderError("Unexpected API redirect was blocked.");
    const raw = await response.text();
    if (raw.length > 6000000) throw new ProviderError("The API response exceeds the allowed size.");
    let result;
    try { result = JSON.parse(raw); } catch { throw new ProviderError("The provider returned invalid JSON. Existing results were not replaced."); }
    if (result?.error) throw new ProviderError("The provider returned an unsuccessful result. No data was replaced.");
    return result;
  } catch (e) {
    if (timedOut) throw new Error("Request timed out after 60 seconds. No automatic retry. The provider may still charge.");
    if (signal.aborted) throw new Error("Request cancelled. The provider may still charge for work already started.");
    if (e instanceof ProviderError) throw e;
    if (e instanceof Error && e.message.startsWith("Connect your")) throw e;
    throw new Error("Network request failed. Check your internet connection; no automatic retry.");
  } finally {
    credential = undefined;
    clearTimeout(timer); signal.removeEventListener("abort", abort);
  }
}
class ProviderError extends Error {}
export async function getCatalog(signal = new AbortController().signal, force = false): Promise<Catalog> {
  if (catalog && !force && Date.now() - catalog.at < 6 * 60 * 60 * 1000) return catalog;
  const results = await Promise.all([
    request("/api/v1/models", signal, undefined, undefined, false),
    request("/api/v1/models?output_modalities=transcription", signal, undefined, undefined, false),
  ]);
  const permitted = new Set<string>([...A_MODELS, ...B_MODELS]);
  const list = new Map<string, ModelInfo>();
  for (const result of results) {
    if (!Array.isArray(result.data)) throw new Error("Invalid model catalog. No model was automatically substituted.");
    for (const m of result.data) {
      if (typeof m.id === "string" && permitted.has(m.id)) {
        const pricing: Record<string, string> = {};
        for (const [k, v] of Object.entries(m.pricing ?? {})) if (typeof v === "string" && Number.isFinite(Number(v)) && Number(v) >= 0) pricing[k] = v;
        list.set(m.id, { id: m.id, pricing, supported_parameters: Array.isArray(m.supported_parameters) ? m.supported_parameters.filter((p: unknown) => typeof p === "string") : [], contextLength: typeof m.context_length === "number" ? m.context_length : 0 });
      }
    }
  }
  return catalog = { at: Date.now(), models: [...list.values()] };
}
async function verifyModel(model: string, parameters: Parameters | undefined, signal: AbortSignal) {
  if (![...A_MODELS, ...B_MODELS].includes(model as never)) throw new Error("Model is not permitted.");
  const info = (await getCatalog(signal)).models.find(m => m.id === model);
  if (!info) throw new Error("The selected model is no longer available. Select another model in Settings.");
  if (parameters) {
    const unsupported = Object.keys(parameters).filter(k => parameters[k as keyof Parameters] !== undefined && !info.supported_parameters.includes(k));
    if (unsupported.length) throw new Error(`The selected model does not support: ${unsupported.join(", ")}. Change its settings or select another model.`);
  }
  return info;
}
export async function connectKey(candidate: string, signal: AbortSignal) {
  const value = candidate.trim();
  if (value.length < 20 || value.length > 256 || /\s/.test(value)) throw new Error("Enter a valid OpenRouter API key.");
  const result = await request("/api/v1/key", signal, undefined, value);
  if (!result?.data || typeof result.data !== "object") throw new Error("The key could not be verified.");
  if (signal.aborted) throw new Error("Key connection cancelled.");
  await keyStorage.save(value, signal);
}
export async function transcribe(uri: string, settings: Settings, signal: AbortSignal) {
  await verifyModel(settings.aModel, undefined, signal);
  const data = await audioFiles.base64(uri);
  if (signal.aborted) throw new Error("Request cancelled.");
  const body = { model: settings.aModel, input_audio: { data, format: "m4a" }, language: "en", response_format: "json",
    // Temperature is a documented normalized STT field, not a generic model prompt.
    temperature: settings.aTemperature };
  const result = await request("/api/v1/audio/transcriptions", signal, body);
  if (typeof result.text !== "string" || !result.text.trim() || result.text.length > 10000) throw new Error("Transcription is empty, invalid or exceeds 10,000 characters. Existing A was not replaced.");
  return { text: result.text, cost: safeCost(result.usage?.cost) };
}
function safeCost(value: unknown) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null; }
export async function chat(model: string, prompt: string, source: string, parameters: Parameters, signal: AbortSignal, context: Record<string, string> = {}) {
  if (!prompt.trim() || prompt.length > 20000 || !source.trim() || source.length > 22000) throw new Error("Text or instruction is empty or exceeds the allowed length.");
  const info = await verifyModel(model, parameters, signal);
  const content = JSON.stringify({ ...context, text: source });
  // Conservative byte bound avoids guessing tokenizer-specific counts or silently truncating data.
  if (!info.contextLength || new TextEncoder().encode(prompt + content).length + parameters.max_tokens + 1024 > info.contextLength) throw new Error("The instruction and text exceed the verified context budget for this model.");
  const result = await request("/api/v1/chat/completions", signal, {
    model, messages: [{ role: "system", content: prompt }, { role: "user", content }],
    ...parameters, stream: false, provider: { require_parameters: true, allow_fallbacks: false },
  });
  const choice = result.choices?.[0];
  const output = choice?.message?.content;
  if (choice?.message?.tool_calls?.length || typeof output !== "string" || !output.trim() || output.length > 10000) throw new Error("The model returned invalid or empty text. Existing results were not replaced.");
  if (!["stop", "length"].includes(choice.finish_reason)) throw new Error("The model did not finish normally. Existing results were not replaced.");
  return { text: output.trim(), complete: choice.finish_reason === "stop", cost: safeCost(result.usage?.cost) };
}
export function modelPrice(info: ModelInfo, transcription: boolean) {
  if (transcription && info.id.includes("whisper")) {
    const second = Number(info.pricing.prompt);
    return Number.isFinite(second) ? `$${(second * 60).toFixed(5)}/min audio` : "Price unavailable";
  }
  const input = Number(info.pricing.prompt), output = Number(info.pricing.completion);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return "Price unavailable";
  return `$${(input * 1e6).toFixed(2)} in · $${(output * 1e6).toFixed(2)} out / 1M tokens · mean $${((input + output) * 5e5).toFixed(2)} (not an estimate)`;
}
