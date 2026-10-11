import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MAX_RECORDING_SECONDS } from "./prototype-config";
import { PrototypeError } from "./prototype-errors";

const exec = promisify(execFile);
const PREFIX = "english-lab-audio-";

export async function cleanupAudioTemporaryFiles() {
  for (const name of await readdir(tmpdir())) {
    if (!name.startsWith(PREFIX)) continue;
    const dir = path.join(tmpdir(), name);
    const info = await stat(dir).catch(() => null);
    if (info && Date.now() - info.mtimeMs > 15 * 60_000) await rm(dir, { recursive: true, force: true });
  }
}

// Decode to verify actual content/duration (WebM containers often have no
// duration header). Stream PCM to null output: no permanent converted copy.
export async function validateAudio(buffer: Buffer, signal: AbortSignal): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), PREFIX));
  const file = path.join(dir, "input");
  try {
    await writeFile(file, buffer);
    let probe: any;
    try {
      const result = await exec("ffprobe", [
        "-v", "error", "-protocol_whitelist", "file,pipe", "-show_entries",
        "format=format_name,duration:stream=codec_type,codec_name,duration", "-of", "json", file,
      ], { timeout: 10_000, maxBuffer: 64_000, signal });
      probe = JSON.parse(result.stdout);
    } catch {
      throw new PrototypeError(415, "AUDIO_FORMAT", "Не удалось прочитать аудио. Запишите новый фрагмент.");
    }
    const formats: string = probe.format?.format_name ?? "";
    const format = formats.includes("webm") ? "webm" : formats.includes("ogg") ? "ogg" : formats === "wav" ? "wav" : formats === "mp3" ? "mp3" : null;
    if (!format || !probe.streams?.some((s: any) => s.codec_type === "audio") || probe.streams.some((s: any) => s.codec_type === "video")) {
      throw new PrototypeError(415, "AUDIO_FORMAT", "Поддерживается только аудио WebM, Ogg, WAV или MP3.");
    }
    // Decode at most limit+2 seconds, with progress for actual duration and
    // volumedetect for digital silence, rather than trusting client metadata.
    const result = await exec("ffmpeg", [
      "-hide_banner", "-nostdin", "-protocol_whitelist", "file,pipe",
      "-i", file, "-t", String(MAX_RECORDING_SECONDS + 2), "-vn",
      "-af", "volumedetect", "-progress", "pipe:1", "-f", "null", "-",
    ], { timeout: 20_000, maxBuffer: 256_000, signal });
    const times = [...result.stdout.matchAll(/out_time_us=(\d+)/g)];
    const seconds = Number(times.at(-1)?.[1] ?? 0) / 1_000_000;
    if (seconds > MAX_RECORDING_SECONDS + 0.5) throw new PrototypeError(413, "AUDIO_TOO_LONG", "Запись длиннее 120 секунд.");
    if (seconds <= 0) throw new PrototypeError(400, "EMPTY_AUDIO", "Пустая запись.");
    // volumedetect quantizes to signed 16-bit PCM: digital silence is reported
    // as -91 dB, not necessarily -inf.
    const volume = result.stderr.match(/max_volume: (-inf|-?[\d.]+) dB/);
    if (volume && (volume[1] === "-inf" || Number(volume[1]) <= -90)) {
      throw new PrototypeError(400, "SILENT_AUDIO", "В записи тишина. Запишите речь.");
    }
    return format;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
