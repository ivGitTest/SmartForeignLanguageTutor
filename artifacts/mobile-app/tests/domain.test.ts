/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { Repository, type Persistence } from "../core/repository";
import { initialData, dataSchema, defaults, fixedAISettings, settingsSchema, CEFR_PAIRS, cefrPairLabel, improvementPrompt, bFingerprint, translationFingerprint, bIsStale, translationIsStale, normalizeExpression, type AppData, type Card } from "../core/model";
import aiPrompts from "../config/ai-prompts.json";
import aiParameters from "../config/ai-parameters.json";
import legacyBFingerprint from "./fixtures/legacy-b-fingerprint.json";
import { eligible, rate, skipDeleted, startSession } from "../core/learning";
import { sentenceForSelection, transcriptDocument } from "../core/selection";
import { operations } from "../core/operations";
import { createMaterialActions } from "../core/material-actions";
import { formatRecordingTitle, titleForMaterial } from "../core/recording-title";

function card(id: string, dueAt: number | null = null): Card {
  return { id, createdAt: Number(id) || 1, expression: `word ${id}`, translation: "слово", example: "", interval: 0, repetition: 0, efactor: 2.5, dueAt, timezone: "UTC" };
}
function memory(initial: AppData = initialData()) {
  let saved = JSON.stringify(initial);
  const persistence: Persistence = { async read() { return saved; }, async write(value) { saved = value; } };
  return { repo: new Repository(persistence), persistence, saved: () => saved };
}
function materialData() {
  const d = initialData();
  d.settings.consent = true;
  d.materials = dataSchema.shape.materials.parse([{
    id: "m", createdAt: 1, title: "Test", audio: { uri: "test-private.m4a", duration: 1, size: 500 },
    a: "I am not sure.", aRevision: 1, aEdited: false, b: "Previous B.", bARevision: 1,
    bFingerprint: bFingerprint(d.settings), translation: "Предыдущее Б.", translationFingerprint: translationFingerprint(d.settings), incomplete: "", cost: 0,
  }]);
  return d;
}
const result = (text: string, complete = true) => ({ text, complete, cost: null });

test("recording titles use local DD.MM.YYYY/HH:MM:SS/seconds format", () => {
  const date = new Date(2026, 9, 15, 7, 3, 9);
  assert.equal(formatRecordingTitle(date.getTime(), 12.4), "15.10.2026/07:03:09/12s");
  assert.equal(titleForMaterial({ createdAt: date.getTime(), title: "Old title", audio: { duration: 12.4 } }), "15.10.2026/07:03:09/12s");
  assert.equal(titleForMaterial({ createdAt: date.getTime(), title: "Retained title", audio: null }), "Retained title");
});

test("defaults load validated prompts and parameters from config files", () => {
  const s = defaults();
  assert.equal(s.nativeLanguage, "ru");
  assert.equal(s.aTemperature, aiParameters.a.temperature);
  assert.deepEqual(s.bParameters, aiParameters.b);
  assert.deepEqual(s.translationParameters, aiParameters.translation);
  assert.equal(s.bPrompt, aiPrompts.b);
  assert.equal(s.translationPrompt, aiPrompts.translation);
  assert.equal(s.contextPrompt, aiPrompts.context);
  assert.equal(s.bParameters.temperature, 0.2);
  assert.equal(s.translationParameters.temperature, 0.1);
  assert.equal(s.bParameters.seed, undefined);
  assert.match(s.bPrompt, /Не добавляй опыт/);
  assert.equal(settingsSchema.safeParse({ ...s, bModel: "arbitrary/model" }).success, false);
  assert.equal(settingsSchema.safeParse({ ...s, nativeLanguage: "de" }).success, false);
});
test("fixed AI configuration ignores previously saved tuning but keeps model and language", () => {
  const base = defaults();
  const saved = {
    ...base,
    bModel: "openai/gpt-4.1" as const,
    nativeLanguage: "ru" as const,
    aTemperature: 0.5,
    bPrompt: "previous custom B prompt",
    translationPrompt: "previous custom translation prompt",
    contextPrompt: "previous custom contextual prompt",
    bParameters: { temperature: 1.4, top_p: 0.7, max_tokens: 512, seed: 123 },
    translationParameters: { temperature: 0.8, top_p: 0.6, max_tokens: 512, seed: 456 },
  };
  const fixed = fixedAISettings(saved);
  assert.equal(fixed.bModel, saved.bModel);
  assert.equal(fixed.nativeLanguage, saved.nativeLanguage);
  assert.equal(fixed.aTemperature, base.aTemperature);
  assert.equal(fixed.bPrompt, base.bPrompt);
  assert.equal(fixed.translationPrompt, base.translationPrompt);
  assert.equal(fixed.contextPrompt, base.contextPrompt);
  assert.deepEqual(fixed.bParameters, base.bParameters);
  assert.deepEqual(fixed.translationParameters, base.translationParameters);
});
test("invalid ranges and empty/oversize prompts are rejected", () => {
  const s = defaults();
  for (const p of [{ temperature: 2.01 }, { top_p: 0 }, { max_tokens: 63 }, { max_tokens: 64.5 }, { seed: -1 }]) {
    assert.equal(settingsSchema.safeParse({ ...s, bParameters: { ...s.bParameters, ...p } }).success, false);
  }
  for (const bPrompt of [" ", "x".repeat(20001)]) assert.equal(settingsSchema.safeParse({ ...s, bPrompt }).success, false);
});
test("CEFR choices are exactly the six supported pairs; default is B1 to B2", () => {
  assert.deepEqual(CEFR_PAIRS, ["A2-B1", "A2-B2", "A2-C1", "B1-B2", "B1-C1", "B1-C2"]);
  assert.equal(defaults().cefrPair, "B1-B2");
  assert.match(improvementPrompt(defaults()), /с исходного уровня B1 до уровня B2/);
  assert.match(improvementPrompt(defaults()), /речь уровня B2/);
  for (const cefrPair of ["A1-B1", "A2-C2", "B1-B1", "B2-C1", "", null]) {
    assert.equal(settingsSchema.safeParse({ ...defaults(), cefrPair }).success, false);
  }
});
test("CEFR missing in legacy storage defaults without changing saved A", async () => {
  const legacy = JSON.parse(JSON.stringify(materialData()));
  delete legacy.settings.cefrPair;
  delete legacy.materials[0].bCEFRPair;
  legacy.materials[0].bFingerprint = JSON.stringify(legacyBFingerprint);
  const repo = new Repository({ async read() { return JSON.stringify(legacy); }, async write() {} });
  await repo.hydrate();
  assert.equal(repo.snapshot().settings.cefrPair, "B1-B2");
  assert.equal(repo.snapshot().materials[0].bCEFRPair, "B1-B2");
  const { bCEFRPair, ...material } = repo.snapshot().materials[0];
  assert.deepEqual(material, legacy.materials[0]);
  assert.equal(bIsStale(repo.snapshot().materials[0], repo.snapshot().settings), false);
  assert.equal(translationIsStale(repo.snapshot().materials[0], repo.snapshot().settings), false);
});
test("CEFR legacy B1 to B2 supports translation retry without regenerating B", async () => {
  const legacy = JSON.parse(JSON.stringify(materialData()));
  delete legacy.settings.cefrPair;
  delete legacy.materials[0].bCEFRPair;
  legacy.materials[0].bFingerprint = JSON.stringify(legacyBFingerprint);
  legacy.materials[0].translation = "";
  legacy.materials[0].translationError = "Previous translation failed.";
  let saved = JSON.stringify(legacy);
  const persistence = { async read() { return saved; }, async write(value: string) { saved = value; } };
  const repo = new Repository(persistence); await repo.hydrate();
  let calls = 0;
  const actions = createMaterialActions(repo, {
    async transcribe() { throw new Error("A must not run."); },
    async chat(_model, _prompt, source, _parameters, _signal, context) {
      calls++;
      assert.equal(context?.artifact, "B", "Only translation should be requested.");
      assert.equal(source, legacy.materials[0].b);
      return result("Успешный перевод.");
    },
  });
  await actions.retryTranslation("m");
  assert.equal(calls, 1);
  const m = repo.snapshot().materials[0];
  assert.equal(m.a, legacy.materials[0].a);
  assert.equal(m.b, legacy.materials[0].b);
  assert.equal(m.bVersion, legacy.materials[0].bVersion);
  assert.equal(m.translation, "Успешный перевод.");
  assert.equal(m.translationError, "");
  assert.equal(translationIsStale(m, repo.snapshot().settings), false);
  const reopened = new Repository(persistence); await reopened.hydrate();
  assert.equal(bIsStale(reopened.snapshot().materials[0], reopened.snapshot().settings), false);
  for (const pair of CEFR_PAIRS.filter(pair => pair !== "B1-B2")) {
    await repo.update(d => { d.settings.cefrPair = pair; });
    assert.equal(bIsStale(repo.snapshot().materials[0], repo.snapshot().settings), true);
    assert.equal(translationIsStale(repo.snapshot().materials[0], repo.snapshot().settings), true);
    await assert.rejects(actions.retryTranslation("m"), /up-to-date B/);
  }
  assert.equal(calls, 1);
});
test("CEFR legacy compatibility does not make genuinely stale B or translation current", async () => {
  const original = JSON.stringify(legacyBFingerprint);
  const variants = [
    { fingerprint: original, revision: 0 },
    { fingerprint: JSON.stringify(["openai/gpt-4.1", legacyBFingerprint[1], legacyBFingerprint[2]]), revision: 1 },
    { fingerprint: JSON.stringify([legacyBFingerprint[0], "Earlier different prompt", legacyBFingerprint[2]]), revision: 1 },
    { fingerprint: JSON.stringify([legacyBFingerprint[0], legacyBFingerprint[1], { temperature: 0.7, top_p: 1, max_tokens: 2048 }]), revision: 1 },
    { fingerprint: "unknown old fingerprint", revision: 1 },
  ];
  for (const { fingerprint, revision } of variants) {
    const d = materialData();
    d.materials[0].bFingerprint = fingerprint;
    d.materials[0].bARevision = revision;
    const { repo } = memory(d); await repo.hydrate();
    assert.equal(bIsStale(repo.snapshot().materials[0], repo.snapshot().settings), true);
    assert.equal(translationIsStale(repo.snapshot().materials[0], repo.snapshot().settings), true);
    const actions = createMaterialActions(repo, {
      async transcribe() { throw new Error("A must not run."); },
      async chat() { throw new Error("No paid request should run for stale B."); },
    });
    await assert.rejects(actions.retryTranslation("m"), /up-to-date B/);
  }
});
for (const cefrPair of CEFR_PAIRS) {
  test(`CEFR ${cefrPair} persists, reloads and restores defaults without changing materials`, async () => {
    const { repo, persistence } = memory(materialData()); await repo.hydrate();
    const before = structuredClone(repo.snapshot().materials);
    await repo.update(d => { d.settings.cefrPair = cefrPair; });
    const reopened = new Repository(persistence); await reopened.hydrate();
    assert.equal(reopened.snapshot().settings.cefrPair, cefrPair);
    assert.equal(fixedAISettings(reopened.snapshot().settings).cefrPair, cefrPair);
    assert.equal(cefrPairLabel(cefrPair), cefrPair.replace("-", " → "));
    await reopened.update(d => { d.settings = { ...defaults(), consent: d.settings.consent }; });
    const reset = new Repository(persistence); await reset.hydrate();
    assert.equal(reset.snapshot().settings.cefrPair, "B1-B2");
    assert.equal(reset.snapshot().settings.consent, true);
    assert.deepEqual(reset.snapshot().materials, before);
  });
  test(`CEFR ${cefrPair} uses matching prompt and context for B; A is independent`, async () => {
    const d = materialData();
    d.settings.cefrPair = cefrPair;
    const { repo, persistence } = memory(d); await repo.hydrate();
    const [sourceCEFR, targetCEFR] = cefrPair.split("-");
    let transcriptions = 0, chats = 0;
    const actions = createMaterialActions(repo, {
      async transcribe(uri, settings) {
        transcriptions++;
        assert.equal(uri, "test-private.m4a");
        assert.equal(settings.aModel, defaults().aModel);
        assert.equal(settings.aTemperature, defaults().aTemperature);
        assert.equal(settings.learningLanguage, "en");
        return { text: "I am not sure.", cost: null };
      },
      async chat(_model, prompt, source, _parameters, _signal, context) {
        chats++;
        if (context?.artifact === "A") {
          assert.equal(source, "I am not sure.");
          assert.equal(context.sourceLanguage, "en");
          assert.equal(context.sourceCEFR, sourceCEFR);
          assert.equal(context.targetCEFR, targetCEFR);
          assert.ok(prompt.includes(`с исходного уровня ${sourceCEFR} до уровня ${targetCEFR}`));
          assert.ok(prompt.includes(`речь уровня ${targetCEFR}`));
          assert.doesNotMatch(prompt, /\{(?:source|target)CEFR\}/);
          assert.deepEqual([...new Set(prompt.match(/\b(?:A2|B1|B2|C1|C2)\b/g))], [...new Set([sourceCEFR, targetCEFR])]);
          return result("Improved English.");
        }
        assert.equal(context?.artifact, "B");
        assert.equal(context?.targetLanguage, "ru");
        assert.equal(source, "Improved English.");
        return result("Улучшенный английский.");
      },
    });
    await actions.generateA("m");
    assert.equal(transcriptions, 1);
    assert.equal(chats, 0);
    assert.equal(repo.snapshot().materials[0].a, "I am not sure.");
    await actions.generateB("m");
    const m = repo.snapshot().materials[0];
    assert.equal(chats, 2);
    assert.equal(m.a, "I am not sure.");
    assert.equal(m.bSourceA, m.a);
    assert.equal(m.bCEFRPair, cefrPair);
    assert.equal(bIsStale(m, repo.snapshot().settings), false);
    assert.equal(translationIsStale(m, repo.snapshot().settings), false);
    const reopened = new Repository(persistence); await reopened.hydrate();
    assert.equal(reopened.snapshot().materials[0].bCEFRPair, cefrPair);
    for (const other of CEFR_PAIRS.filter(pair => pair !== cefrPair)) {
      await repo.update(d => { d.settings.cefrPair = other; });
      assert.equal(bIsStale(m, repo.snapshot().settings), true);
      assert.equal(translationIsStale(m, repo.snapshot().settings), true);
      assert.equal(repo.snapshot().materials[0].a, "I am not sure.");
      assert.equal(repo.snapshot().materials[0].b, "Improved English.");
      assert.equal(repo.snapshot().materials[0].translation, "Улучшенный английский.");
      await assert.rejects(actions.retryTranslation("m"), /up-to-date B/);
    }
    await repo.update(d => { d.settings.cefrPair = cefrPair; });
    assert.equal(bIsStale(m, repo.snapshot().settings), false);
    assert.equal(translationIsStale(m, repo.snapshot().settings), false);
  });
}
test("CEFR changed during B request leaves results tagged with the requested pair and stale", async () => {
  const { repo } = memory(materialData()); await repo.hydrate();
  let calls = 0;
  const actions = createMaterialActions(repo, {
    async transcribe() { throw new Error("A must not run."); },
    async chat(_model, prompt, _source, _parameters, _signal, context) {
      if (++calls === 1) {
        assert.equal(context?.targetCEFR, "B2");
        assert.match(prompt, /до уровня B2/);
        await repo.update(d => { d.settings.cefrPair = "B1-C2"; });
      }
      return result(calls === 1 ? "B2 result." : "Перевод B2.");
    },
  });
  await actions.generateB("m");
  const m = repo.snapshot().materials[0];
  assert.equal(m.bCEFRPair, "B1-B2");
  assert.equal(bIsStale(m, repo.snapshot().settings), true);
  assert.equal(translationIsStale(m, repo.snapshot().settings), true);
});
test("repository serializes concurrent durable mutations", async () => {
  const { repo, saved } = memory(); await repo.hydrate();
  await Promise.all([repo.update(d => d.cards.push(card("1"))), repo.update(d => d.cards.push(card("2")))]);
  assert.equal(repo.snapshot().cards.length, 2);
  assert.equal(JSON.parse(saved()).cards.length, 2);
});
test("failed save preserves previous visible and durable data and allows retry", async () => {
  const m = memory(); await m.repo.hydrate();
  const write = m.persistence.write;
  m.persistence.write = async () => { throw new Error("storage unavailable"); };
  await assert.rejects(m.repo.update(d => d.cards.push(card("1"))), /Local save failed/);
  assert.equal(m.repo.snapshot().cards.length, 0);
  assert.equal(JSON.parse(m.saved()).cards.length, 0);
  m.persistence.write = write; await m.repo.update(d => d.cards.push(card("2")));
  assert.equal(m.repo.snapshot().cards.length, 1);
});
test("corrupt data is rejected without an automatic reset", async () => {
  let writes = 0;
  const repo = new Repository({ async read() { return "not json"; }, async write() { writes++; } });
  await assert.rejects(repo.hydrate()); assert.equal(writes, 0);
});
test("session chooses due first, new second, at most ten unique ids", () => {
  const d = initialData(); d.cards = Array.from({ length: 15 }, (_, i) => card(String(i + 1)));
  d.cards[13].dueAt = 50; d.cards[12].dueAt = 30;
  startSession(d, 100);
  assert.equal(d.session!.ids.length, 10); assert.equal(new Set(d.session!.ids).size, 10);
  assert.deepEqual(d.session!.ids.slice(0, 2), ["13", "14"]);
});
test("session persists revealed side, fixed queue and rating across reload", async () => {
  const d = initialData(); d.cards = [card("1"), card("2")]; startSession(d);
  d.session!.revealed = true;
  const { repo, persistence } = memory(d); await repo.hydrate();
  await repo.update(d => { d.cards.push(card("3")); rate(d, d.session!.id, "1", 4, 1000); d.session!.revealed = true; });
  const reloaded = new Repository(persistence); await reloaded.hydrate();
  assert.deepEqual(reloaded.snapshot().session!.ids, ["1", "2"]);
  assert.equal(reloaded.snapshot().session!.index, 1); assert.equal(reloaded.snapshot().session!.revealed, true);
  assert.equal(reloaded.snapshot().reviewEvents.length, 1);
});
test("ratings require answer reveal and repeated taps are idempotent", () => {
  const d = initialData(); d.cards = [card("1")]; startSession(d);
  assert.equal(rate(d, d.session!.id, "1", 4), false);
  d.session!.revealed = true;
  assert.equal(rate(d, d.session!.id, "1", 4), true);
  assert.equal(rate(d, d.session!.id, "1", 4), false);
  assert.equal(d.reviewEvents.length, 1);
});
test("SM-2 uses integer 1, 6 and rounded prior-interval*EF UTC day intervals", () => {
  const d = initialData(); d.cards = [card("1")];
  for (const expected of [1, 6, 15]) {
    d.session = null; d.cards[0].dueAt = null; startSession(d, 1000); d.session!.revealed = true;
    rate(d, d.session!.id, "1", 4, 1000);
    assert.equal(d.cards[0].interval, expected); assert.equal(d.cards[0].dueAt, 1000 + expected * 86400000);
    assert.ok(d.cards[0].timezone);
  }
});
test("Again resets repetitions and ease never falls below 1.3", () => {
  const d = initialData(); d.cards = [card("1")];
  for (let i = 0; i < 5; i++) {
    d.session = null; d.cards[0].dueAt = null; startSession(d); d.session!.revealed = true;
    rate(d, d.session!.id, "1", 0);
  }
  assert.equal(d.cards[0].repetition, 0); assert.equal(d.cards[0].interval, 1); assert.equal(d.cards[0].efactor, 1.3);
});
test("deleting a queued card skips it without introducing a newly added card", () => {
  const d = initialData(); d.cards = [card("1"), card("2")]; startSession(d);
  d.cards = [card("2"), card("3")]; skipDeleted(d);
  assert.deepEqual(d.session!.ids, ["1", "2"]); assert.equal(d.session!.index, 1); assert.equal(d.reviewEvents.length, 0);
});
test("there is no empty infinite session when no cards are due", () => {
  const d = initialData(); d.cards = [card("1", 100000)]; startSession(d, 100);
  assert.equal(d.session, null); assert.deepEqual(eligible(d.cards, 100), []);
});
test("meaning context is the source sentence, and HTML-like model output is escaped", () => {
  const text = "I feel ready. I need to figure out the details. Then we can go.";
  const start = text.indexOf("figure out");
  assert.deepEqual(sentenceForSelection(text, start, start + 10), { expression: "figure out", sentence: "I need to figure out the details." });
  assert.equal(sentenceForSelection(text, -1, 4), null);
  assert.ok(transcriptDocument('<img src=x onerror="alert(1)">').includes("&lt;img"));
  assert.equal(normalizeExpression("  To  FIGURE out "), "to figure out");
});
test("A changes mark B and translation stale without removing either", () => {
  const d = materialData(), m = d.materials[0];
  assert.equal(bIsStale(m, d.settings), false);
  m.aRevision++;
  assert.equal(bIsStale(m, d.settings), true); assert.equal(translationIsStale(m, d.settings), true);
  assert.equal(m.b, "Previous B."); assert.equal(m.translation, "Предыдущее Б.");
});
for (const staleReason of ["A revision", "AI model change", "CEFR pair change"] as const) {
  test(`saved stale B remains usable after ${staleReason} without regenerating B`, async () => {
    const d = materialData(), material = d.materials[0];
    if (staleReason === "A revision") material.aRevision++;
    else if (staleReason === "AI model change") d.settings.bModel = "google/gemini-2.5-flash";
    else d.settings.cefrPair = "A2-C1";
    assert.equal(bIsStale(material, d.settings), true);
    const { repo } = memory(d); await repo.hydrate();
    let chatCalls = 0;
    const actions = createMaterialActions(repo, {
      async transcribe() { throw new Error("Transcription must not run."); },
      async chat(_model, _prompt, source, _parameters, _signal, context) {
        chatCalls++;
        const selected = JSON.parse(source) as { expression: string; sentence: string };
        assert.equal(selected.expression, "Previous");
        assert.equal(selected.sentence, "Previous B.");
        assert.equal(context?.targetLanguage, "ru");
        return result("предыдущий");
      },
    });

    const translated = await actions.translateExpression("m", "Previous", "Previous B.", "Previous B.", "b");

    assert.equal(translated, "предыдущий");
    assert.equal(chatCalls, 1);
    assert.equal(repo.snapshot().materials[0].b, "Previous B.");
    assert.equal(bIsStale(repo.snapshot().materials[0], repo.snapshot().settings), true);
  });
}
test("B is durable before a failed translation; retry does not generate B", async () => {
  const { repo } = memory(materialData()); await repo.hydrate();
  let calls = 0;
  const actions = createMaterialActions(repo, { async transcribe() { return { text: "A", cost: null }; }, async chat() {
    calls++; if (calls === 2) throw new Error("Rate limit reached."); return result(calls === 1 ? "New B." : "Новое Б.");
  } });
  await assert.rejects(actions.generateB("m"), /Rate limit/);
  assert.equal(repo.snapshot().materials[0].b, "New B.");
  assert.equal(repo.snapshot().materials[0].translation, "");
  assert.match(repo.snapshot().materials[0].translationError, /Rate limit/);
  await actions.retryTranslation("m");
  assert.equal(calls, 3); assert.equal(repo.snapshot().materials[0].translation, "Новое Б.");
});
test("incomplete B is separate, keeps previous successful B, and never triggers translation", async () => {
  const { repo } = memory(materialData()); await repo.hydrate();
  let calls = 0;
  const actions = createMaterialActions(repo, { async transcribe() { return { text: "A", cost: null }; }, async chat() { calls++; return result("Partial", false); } });
  await assert.rejects(actions.generateB("m"), /cut short/);
  const m = repo.snapshot().materials[0];
  assert.equal(calls, 1); assert.equal(m.b, "Previous B."); assert.equal(m.incomplete, "Partial"); assert.equal(m.translation, "Предыдущее Б.");
});
test("cancelled late B cannot overwrite saved data", async () => {
  const { repo } = memory(materialData()); await repo.hydrate();
  let finish!: (value: ReturnType<typeof result>) => void;
  const wait = new Promise<ReturnType<typeof result>>(resolve => { finish = resolve; });
  const actions = createMaterialActions(repo, { async transcribe() { return { text: "A", cost: null }; }, async chat() { return wait; } });
  const pending = actions.generateB("m");
  operations.cancel(); finish(result("Late B"));
  await assert.rejects(pending, /cancelled/);
  assert.equal(repo.snapshot().materials[0].b, "Previous B.");
});
test("editing the source rejects a late B even without network cooperation", async () => {
  const { repo } = memory(materialData()); await repo.hydrate();
  let finish!: (value: ReturnType<typeof result>) => void;
  let begun!: () => void; const started = new Promise<void>(resolve => { begun = resolve; });
  const actions = createMaterialActions(repo, { async transcribe() { return { text: "A", cost: null }; }, async chat() { begun(); return new Promise(resolve => { finish = resolve; }); } });
  const pending = actions.generateB("m");
  await started;
  await repo.update(d => { d.materials[0].aRevision++; d.materials[0].a = "Changed A."; });
  finish(result("Late B"));
  await assert.rejects(pending, /source changed/);
  assert.equal(repo.snapshot().materials[0].b, "Previous B.");
});
test("chain uses fixed prompts and parameters, and ignores saved prompt edits", async () => {
  const { repo } = memory(materialData()); await repo.hydrate();
  const seen: { prompt: string; target?: string; temperature?: number }[] = [];
  await repo.update(d => {
    d.settings.bPrompt = "previous custom B prompt";
    d.settings.translationPrompt = "previous custom translation prompt";
    d.settings.bParameters = { temperature: 1.2, top_p: 0.8, max_tokens: 512 };
  });
  const actions = createMaterialActions(repo, { async transcribe() { return { text: "A", cost: null }; }, async chat(_model, prompt, _source, params, _signal, context) {
    seen.push({ prompt, target: context?.targetCEFR, temperature: params.temperature });
    if (seen.length === 1) await repo.update(d => { d.settings.bPrompt = "New setting during request"; });
    return result(seen.length === 1 ? "New B." : "Перевод.");
  } });
  await actions.generateB("m");
  assert.equal(seen[0].prompt, improvementPrompt(defaults())); assert.equal(seen[0].target, "B2");
  assert.equal(seen[0].temperature, defaults().bParameters.temperature);
  assert.equal(seen[1].prompt, defaults().translationPrompt);
  assert.equal(seen[1].temperature, defaults().translationParameters.temperature);
  assert.equal(bIsStale(repo.snapshot().materials[0], repo.snapshot().settings), false);
});
test("no A without audio and no B without A", async () => {
  const d = materialData(); d.materials[0].audio = null; d.materials[0].a = "";
  const { repo } = memory(d); await repo.hydrate();
  const actions = createMaterialActions(repo, { async transcribe() { throw new Error("Should not run"); }, async chat() { throw new Error("Should not run"); } });
  await assert.rejects(actions.generateA("m"), /saved audio/); await assert.rejects(actions.generateB("m"), /edit A first/);
});
