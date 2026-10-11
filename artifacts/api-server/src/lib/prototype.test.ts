import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RewriteTranscriptBody } from "@workspace/api-zod";
import { RequestGate } from "../middlewares/prototypeAccess";
import { PrototypeError } from "./prototype-errors";
import { validateAudio } from "./audio-validation";
import { DEFAULT_INSTRUCTION, prototypeConfig } from "./prototype-config";

const input = {
  recordingId: "bd8cb39b-f404-46b4-ad38-cd4aeb6e70f1",
  requestId: "a1c71ba7-99d7-453a-b5c7-4a31f103df23",
  textRevision: 0, text: "Yesterday I went to the shop.", sourceLevel: "B1",
  targetLevel: "B2", instruction: "Keep the same meaning.", settingsRevision: 0,
  parameters: { temperature: 0.2, top_p: 1, max_tokens: 2048 },
};
const schema = RewriteTranscriptBody.strict().extend({ parameters: RewriteTranscriptBody.shape.parameters.strict() });

test("both target levels and optional seed, never silently substitute instruction", () => {
  for (const targetLevel of ["B2", "C1"]) {
    const result = schema.parse({ ...input, targetLevel, parameters: { ...input.parameters, seed: 0 } });
    assert.equal(result.instruction, input.instruction);
    assert.equal(result.parameters.seed, 0);
  }
});
test("reject unsupported parameters/models and invalid ranges", () => {
  for (const parameters of [
    { ...input.parameters, temperature: -1 }, { ...input.parameters, temperature: 2.01 },
    { ...input.parameters, top_p: 0 }, { ...input.parameters, top_p: 1.01 },
    { ...input.parameters, max_tokens: 63 }, { ...input.parameters, max_tokens: 4097 },
    { ...input.parameters, seed: -1 }, { ...input.parameters, seed: 1.5 },
    { ...input.parameters, top_k: 40 },
  ]) assert.equal(schema.safeParse({ ...input, parameters }).success, false);
  assert.equal(schema.safeParse({ ...input, model: "unapproved" }).success, false);
  assert.equal(schema.safeParse({ ...input, targetLevel: "C2" }).success, false);
  assert.equal(schema.safeParse({ ...input, text: "a".repeat(10001) }).success, false);
  assert.equal(schema.safeParse({ ...input, instruction: "a".repeat(20001) }).success, false);
});
test("one active request per owner, release and five starts per rolling minute", () => {
  const gate = new RequestGate();
  const release = gate.acquire("owner", 0);
  assert.throws(() => gate.acquire("owner", 1), (error) => error instanceof PrototypeError && error.status === 409);
  release();
  for (let i = 1; i < 5; i++) gate.acquire("owner", i)();
  assert.throws(() => gate.acquire("owner", 6), (error) => error instanceof PrototypeError && error.status === 429);
  gate.acquire("owner", 60_001)();
});
test("configuration does not contain server credential, baseline has no token hidden in instruction", () => {
  const config = prototypeConfig();
  assert.equal(config.defaultParameters.temperature, 0.2);
  assert.equal(config.defaultTranscriptionTemperature, 0);
  assert.equal(config.maxRecordingSeconds, 120);
  assert.equal(config.defaultInstruction, DEFAULT_INSTRUCTION);
  assert.equal("apiKey" in config, false);
});
test("audio bytes checked, not filename or client declared format", async () => {
  const exec = promisify(execFile);
  const wav = await exec("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-f", "wav", "pipe:1"], { encoding: "buffer", maxBuffer: 1_000_000 });
  assert.equal(await validateAudio(wav.stdout, new AbortController().signal), "wav");
  const webm = await exec("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", "libopus", "-f", "webm", "pipe:1"], { encoding: "buffer", maxBuffer: 1_000_000 });
  assert.equal(await validateAudio(webm.stdout, new AbortController().signal), "webm");
  const ogg = await exec("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", "libopus", "-f", "ogg", "pipe:1"], { encoding: "buffer", maxBuffer: 1_000_000 });
  assert.equal(await validateAudio(ogg.stdout, new AbortController().signal), "ogg");
  await assert.rejects(validateAudio(Buffer.from("not audio"), new AbortController().signal), (error) => error instanceof PrototypeError && error.status === 415);
  const silence = await exec("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "1", "-f", "wav", "pipe:1"], { encoding: "buffer", maxBuffer: 1_000_000 });
  await assert.rejects(validateAudio(silence.stdout, new AbortController().signal), (error) => error instanceof PrototypeError && error.code === "SILENT_AUDIO");
});
