import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Repository } from "../../artifacts/mobile-app/core/repository";
import { initialData, dataSchema } from "../../artifacts/mobile-app/core/model";
import { createMaterialActions } from "../../artifacts/mobile-app/core/material-actions";
import { startSession } from "../../artifacts/mobile-app/core/learning";
import { sentenceForSelection } from "../../artifacts/mobile-app/core/selection";

const samples = JSON.parse(readFileSync(new URL("./sample-data.json", import.meta.url), "utf8"));

async function populated() {
  const data = initialData();
  data.settings.consent = true;
  data.cards = samples.words.map((word: object, index: number) => ({
    ...word, id: `sample-${index}`, createdAt: index + 1,
    interval: 0, repetition: 0, efactor: 2.5, dueAt: null, timezone: "UTC",
  }));
  data.materials = dataSchema.shape.materials.parse(samples.materials.map((item: { title: string }, index: number) => ({
    id: `material-${index}`, title: item.title, createdAt: index + 1,
    audio: { uri: `fixture-${index}.m4a`, duration: 2, size: 500 },
    a: "", aRevision: 0, aEdited: false, b: "", bARevision: 0,
    bFingerprint: "", translation: "", translationFingerprint: "", incomplete: "", cost: 0,
  })));
  let saved = JSON.stringify(data);
  const storage = {
    async read() { return saved; },
    async write(value: string) { saved = value; },
  };
  const repo = new Repository(storage);
  await repo.hydrate();
  return { repo, storage };
}

test("dictionary sample cards and material list survive a repository reload", async () => {
  const { repo, storage } = await populated();
  assert.equal(repo.snapshot().cards.length, 10);
  assert.equal(repo.snapshot().materials.length, 2);
  await repo.update(d => {
    d.cards[0].translation = "организовать совещание";
    startSession(d, 100);
    d.session!.revealed = true;
  });
  const reopened = new Repository(storage);
  await reopened.hydrate();
  assert.deepEqual(reopened.snapshot(), repo.snapshot());
  assert.equal(reopened.snapshot().session!.ids.length, 10);
  assert.equal(reopened.snapshot().session!.revealed, true);
});

test("materials successful A B translation and contextual lookup use only supplied responses", async () => {
  const { repo, storage } = await populated();
  const sample = samples.materials[0];
  const calls: string[] = [];
  const actions = createMaterialActions(repo, {
    async transcribe(uri) {
      assert.equal(uri, "fixture-0.m4a");
      calls.push("A");
      return { text: sample.a, cost: null };
    },
    async chat(_model, _prompt, source, _parameters, _signal, context) {
      if (context?.artifact === "A") {
        assert.equal(source, sample.a);
        assert.equal(context.targetCEFR, "B2");
        calls.push("B");
        return { text: sample.b, complete: true, cost: null };
      }
      // The contextual request includes structured source context.
      if (calls.length >= 3) {
        assert.match(source, /figure out/);
        calls.push("context");
        return { text: sample.meaning, complete: true, cost: null };
      }
      assert.equal(source, sample.b);
      assert.equal(context?.targetLanguage, "ru");
      calls.push("translation");
      return { text: sample.translation, complete: true, cost: null };
    },
  });
  await actions.generateA("material-0");
  await actions.generateB("material-0");
  const m = repo.snapshot().materials[0];
  assert.equal(m.a, sample.a);
  assert.equal(m.b, sample.b);
  assert.equal(m.translation, sample.translation);
  assert.deepEqual(calls, ["A", "B", "translation"]);
  const start = sample.b.indexOf(sample.expression);
  const selection = sentenceForSelection(sample.b, start, start + sample.expression.length)!;
  assert.ok(selection);
  assert.equal(await actions.translateExpression("material-0", selection.expression, selection.sentence, sample.b, "b"), sample.meaning);
  const reopened = new Repository(storage);
  await reopened.hydrate();
  assert.deepEqual(reopened.snapshot().materials, repo.snapshot().materials);
});
