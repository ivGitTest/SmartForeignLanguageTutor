import AsyncStorage from "@react-native-async-storage/async-storage";
import { bFingerprint as makeBFingerprint, defaults, type Material } from "./model";
import type { Repository } from "./repository";

const SEED_KEY = "smart-lang-tutor-preview-materials-seeded-v2";
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
    translation: "",
    translationFingerprint: "",
    incomplete: "",
    cost: 0,
    costKnown: false,
    translationLanguage: "ru",
    translationError: "",
    translationBVersion: 0,
    translationCreatedAt: 0,
    pendingAI: null,
    lastAIError: "",
  };
}

function createPreviewMaterials(now: number): Material[] {
  return [
    createMaterial(
      `${DEMO_ID_PREFIX}audio-only`,
      "Preview · Audio only",
      now - 3 * 60_000,
    ),
    createMaterial(
      `${DEMO_ID_PREFIX}audio-a`,
      "Preview · Audio + A",
      now - 2 * 60_000,
      "I went to the store yesterday and bought some milk.",
    ),
    createMaterial(
      `${DEMO_ID_PREFIX}audio-a-b`,
      "Preview · Audio + A + B",
      now - 60_000,
      "I usually take the bus to work, but today I walked because the weather was nice.",
      "I usually commute by bus, but I walked to work today because the weather was pleasant.",
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
        if (existing) existing.audio = material.audio;
        else data.materials.push(material);
      }
    });
    await AsyncStorage.setItem(SEED_KEY, "1");
  } catch (error) {
    console.warn("Could not add development-only preview materials.", error);
  }
}
