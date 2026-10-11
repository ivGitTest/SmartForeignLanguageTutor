import { Router } from "express";
import multer from "multer";
import {
  GetPrototypeConfigResponse, RewriteTranscriptBody, RewriteTranscriptResponse,
  TranscribeRecordingBody, TranscribeRecordingResponse,
} from "@workspace/api-zod";
import { requireOwner, paidRequest } from "../middlewares/prototypeAccess";
import { prototypeConfig, MAX_AUDIO_BYTES, TIMEOUT_MS, TRANSCRIPTION_MODEL, REWRITE_MODEL, DEFAULTS_VERSION } from "../lib/prototype-config";
import { PrototypeError } from "../lib/prototype-errors";
import { callOpenRouter, costFrom } from "../lib/openrouter";
import { validateAudio, cleanupAudioTemporaryFiles } from "../lib/audio-validation";
import type { Request, Response } from "express";

const router = Router();
router.use(requireOwner);
router.get("/config", (_req, res) => res.json(GetPrototypeConfigResponse.parse(prototypeConfig())));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 4, fieldSize: 256 } });

function operationSignal(req: Request, res: Response) {
  const controller = new AbortController();
  const elapsed = Date.now() - (res.locals.operationStartedAt ?? Date.now());
  const timeout = setTimeout(() => controller.abort(new PrototypeError(504, "TIMEOUT", "Время ожидания истекло. Повтор может быть платным.", true)), Math.max(1, TIMEOUT_MS - elapsed));
  const disconnect = () => {
    if (!res.writableEnded) controller.abort(new PrototypeError(499, "CANCELLED", "Ожидание отменено; провайдер мог списать средства."));
  };
  res.once("close", disconnect);
  return {
    signal: controller.signal,
    close: () => { clearTimeout(timeout); res.off("close", disconnect); },
  };
}

const rewriteSchema = RewriteTranscriptBody.strict().extend({
  parameters: RewriteTranscriptBody.shape.parameters.strict(),
});
router.post("/rewrites", paidRequest, async (req, res) => {
  const parsed = rewriteSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.text.trim() || !parsed.data.instruction.trim()) {
    throw new PrototypeError(400, "INVALID_SETTINGS", "Проверьте текст, инструкцию, уровни и диапазоны параметров.");
  }
  const input = parsed.data;
  const operation = operationSignal(req, res);
  const start = Date.now();
  try {
    const data = await callOpenRouter("chat/completions", {
      model: REWRITE_MODEL,
      messages: [
        { role: "system", content: input.instruction },
        { role: "user", content: `Source CEFR: B1\nTarget CEFR: ${input.targetLevel}\n\nTranscript:\n${input.text}` },
      ],
      ...input.parameters,
      provider: { require_parameters: true },
      stream: false,
    }, operation.signal);
    const choice = data.choices?.[0];
    if (typeof choice?.message?.content !== "string" || !choice.message.content.trim()) {
      throw new PrototypeError(502, "EMPTY_RESULT", "Модель не вернула текст.");
    }
    res.json(RewriteTranscriptResponse.parse({
      ...input, text: choice.message.content, model: data.model ?? REWRITE_MODEL,
      defaultsVersion: DEFAULTS_VERSION, finishReason: choice.finish_reason ?? "unknown",
      processingMs: Date.now() - start, createdAt: new Date().toISOString(), usageCostUsd: costFrom(data),
    }));
  } catch (error) {
    if (operation.signal.aborted) throw operation.signal.reason;
    throw error;
  } finally { operation.close(); }
});

router.post("/transcriptions", paidRequest, upload.single("audio"), async (req, res) => {
  if (!req.file) throw new PrototypeError(400, "AUDIO_REQUIRED", "Не передана аудиозапись.");
  const metadata = TranscribeRecordingBody.omit({ audio: true }).strict().safeParse({
    ...req.body,
    temperature: typeof req.body.temperature === "string" && req.body.temperature.trim() !== ""
      ? Number(req.body.temperature)
      : undefined,
  });
  if (!metadata.success) throw new PrototypeError(400, "INVALID_REQUEST", "Некорректные параметры записи.");
  const operation = operationSignal(req, res);
  const start = Date.now();
  try {
    const format = await validateAudio(req.file.buffer, operation.signal);
    const data = await callOpenRouter("audio/transcriptions", {
      model: TRANSCRIPTION_MODEL, input_audio: { data: req.file.buffer.toString("base64"), format },
      language: "en", temperature: metadata.data.temperature, response_format: "json",
    }, operation.signal);
    if (typeof data.text !== "string" || !data.text.trim()) throw new PrototypeError(502, "EMPTY_TRANSCRIPT", "Не распознана речь. Проверьте запись.");
    res.json(TranscribeRecordingResponse.parse({
      ...metadata.data, text: data.text, model: TRANSCRIPTION_MODEL,
      processingMs: Date.now() - start, createdAt: new Date().toISOString(), usageCostUsd: costFrom(data),
    }));
  } catch (error) {
    if (operation.signal.aborted) throw operation.signal.reason;
    throw error;
  } finally {
    req.file.buffer = Buffer.alloc(0);
    operation.close();
  }
});

void cleanupAudioTemporaryFiles().catch(() => {});
const cleanup = setInterval(() => { void cleanupAudioTemporaryFiles().catch(() => {}); }, 60_000);
cleanup.unref();

export default router;
