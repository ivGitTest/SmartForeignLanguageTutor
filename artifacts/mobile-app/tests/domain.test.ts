/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { Repository, type Persistence } from "../core/repository";
import { initialData, dataSchema, defaults, settingsSchema, bFingerprint, translationFingerprint, bIsStale, translationIsStale, normalizeExpression, type AppData, type Card } from "../core/model";
import { eligible, rate, skipDeleted, startSession } from "../core/learning";
import { sentenceForSelection, transcriptDocument } from "../core/selection";
import { operations } from "../core/operations";
import { createMaterialActions } from "../core/material-actions";

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

test("defaults are fixed EN/RU/EN, B1-B2 prompts and permitted models", () => {
  const s = defaults();
  assert.equal(s.nativeLanguage, "ru");
  assert.equal(s.bParameters.temperature, 0.2);
  assert.equal(s.translationParameters.temperature, 0.1);
  assert.equal(s.bParameters.seed, undefined);
  assert.match(s.bPrompt, /Не добавляй опыт/);
  assert.equal(settingsSchema.safeParse({ ...s, bModel: "arbitrary/model" }).success, false);
  assert.equal(settingsSchema.safeParse({ ...s, nativeLanguage: "de" }).success, false);
});
test("invalid ranges and empty/oversize prompts are rejected", () => {
  const s = defaults();
  for (const p of [{ temperature: 2.01 }, { top_p: 0 }, { max_tokens: 63 }, { max_tokens: 64.5 }, { seed: -1 }]) {
    assert.equal(settingsSchema.safeParse({ ...s, bParameters: { ...s.bParameters, ...p } }).success, false);
  }
  for (const bPrompt of [" ", "x".repeat(20001)]) assert.equal(settingsSchema.safeParse({ ...s, bPrompt }).success, false);
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
test("chain snapshots edited prompt and fixed target B2, not new settings during response", async () => {
  const { repo } = memory(materialData()); await repo.hydrate();
  const seen: { prompt: string; target?: string }[] = [];
  const actions = createMaterialActions(repo, { async transcribe() { return { text: "A", cost: null }; }, async chat(_model, prompt, _source, _params, _signal, context) {
    seen.push({ prompt, target: context?.targetCEFR });
    if (seen.length === 1) await repo.update(d => { d.settings.bPrompt = "New setting during request"; });
    return result(seen.length === 1 ? "New B." : "Перевод.");
  } });
  await actions.generateB("m");
  assert.equal(seen[0].prompt, defaults().bPrompt); assert.equal(seen[0].target, "B2");
  assert.equal(seen[1].prompt, defaults().translationPrompt); assert.equal(bIsStale(repo.snapshot().materials[0], repo.snapshot().settings), true);
});
test("no A without audio and no B without A", async () => {
  const d = materialData(); d.materials[0].audio = null; d.materials[0].a = "";
  const { repo } = memory(d); await repo.hydrate();
  const actions = createMaterialActions(repo, { async transcribe() { throw new Error("Should not run"); }, async chat() { throw new Error("Should not run"); } });
  await assert.rejects(actions.generateA("m"), /saved audio/); await assert.rejects(actions.generateB("m"), /edit A first/);
});
