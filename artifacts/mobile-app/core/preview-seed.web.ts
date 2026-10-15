import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  bFingerprint as makeBFingerprint,
  defaults,
  translationFingerprint as makeTranslationFingerprint,
  type Material,
} from "./model";
import type { Repository } from "./repository";
import { formatRecordingTitle } from "./recording-title";

const SEED_KEY = "smart-lang-tutor-preview-materials-seeded-v4";
const DEMO_ID_PREFIX = "preview-material-";
const SILENT_AUDIO =
  "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

 function createOneSecondSilentAudioUri(): string {
  const base64 = SILENT_AUDIO.slice(SILENT_AUDIO.indexOf(",") + 1);
  const original = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  const originalSamples = original.subarray(44);
  const sampleCount = originalSamples.length * 10;
  const bytes = new Uint8Array(44 + sampleCount);
  bytes.set(original.subarray(0, 44));
  for (let offset = 44; offset < bytes.length; offset += originalSamples.length) {
    bytes.set(originalSamples, offset);
  }
  const header = new DataView(bytes.buffer);
  header.setUint32(4, bytes.length - 8, true);
  header.setUint32(40, sampleCount, true);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
}

const ONE_SECOND_SILENT_AUDIO = createOneSecondSilentAudioUri();

function createMaterial(
  id: string,
  title: string,
  createdAt: number,
  a = "",
  b = "",
  translation = "",
): Material {
  const settings = defaults();
  const aRevision = a ? 1 : 0;
  const bVersion = b ? 1 : 0;
  return {
    id,
    title,
    createdAt,
    audio: { uri: ONE_SECOND_SILENT_AUDIO, duration: 1, size: 8_044 },
    a,
    aRevision,
    aEdited: false,
    b,
    bARevision: bVersion ? aRevision : 0,
    bFingerprint: bVersion ? makeBFingerprint(settings) : "",
    bVersion,
    bModelUsed: bVersion ? settings.bModel : "",
    bCreatedAt: bVersion ? createdAt : 0,
    aModelUsed: a ? settings.aModel : "",
    aCreatedAt: a ? createdAt : 0,
    aTemperatureUsed: 0,
    bSourceA: b ? a : "",
    translation,
    translationFingerprint: translation ? makeTranslationFingerprint(settings) : "",
    incomplete: "",
    cost: 0,
    costKnown: false,
    translationLanguage: "ru",
    translationError: "",
    translationBVersion: translation ? bVersion : 0,
    translationCreatedAt: translation ? createdAt : 0,
    pendingAI: null,
    lastAIError: "",
  };
}

function createPreviewMaterials(now: number): Material[] {
  return [
    createMaterial(
      `${DEMO_ID_PREFIX}audio-only`,
      formatRecordingTitle(now - 3 * 60_000, 1),
      now - 3 * 60_000,
    ),
    createMaterial(
      `${DEMO_ID_PREFIX}audio-a`,
      formatRecordingTitle(now - 2 * 60_000, 1),
      now - 2 * 60_000,
      "I went to the store yesterday and bought some milk.",
    ),
    createMaterial(
      `${DEMO_ID_PREFIX}audio-a-b`,
      formatRecordingTitle(now - 60_000, 1),
      now - 60_000,
      "I usually take the bus to work, but today I walked because the weather was nice.",
      "I usually commute by bus, but I walked to work today because the weather was pleasant.",
      "Обычно я езжу на работу на автобусе, но сегодня пошёл пешком, потому что погода была приятной.",
    ),
  ];
}

export async function seedPreviewMaterials(repository: Repository): Promise<void> {
  try {
    if (await AsyncStorage.getItem(SEED_KEY)) return;

    const materials = createPreviewMaterials(Date.now());
    await repository.update(data => {
      for (const material of materials) {
        const existing = data.materials.find(candidate => candidate.id === material.id);
        if (existing) {
          existing.audio = material.audio;
          existing.title = material.title;
          if (material.translation && existing.b === material.b && !existing.translation) {
            existing.translation = material.translation;
            existing.translationFingerprint = material.translationFingerprint;
            existing.translationError = "";
            existing.translationBVersion = material.translationBVersion;
            existing.translationCreatedAt = material.translationCreatedAt;
          }
        }
        else data.materials.push(material);
      }
    });
    await AsyncStorage.setItem(SEED_KEY, "1");
  } catch (error) {
    console.warn("Could not add development-only preview materials.", error);
  }
}
