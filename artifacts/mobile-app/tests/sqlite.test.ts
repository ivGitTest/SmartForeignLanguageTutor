/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { initializeSqlite, readSqlite, writeSqlite, type SqlAccess } from "../core/sqlite-snapshot";
import { initialData, type AppData } from "../core/model";
function database() {
  const raw = new DatabaseSync(":memory:");
  const sql: SqlAccess = {
    async execAsync(query) { raw.exec(query); },
    async runAsync(query, ...params) { raw.prepare(query).run(...params); },
    async getFirstAsync<T>(query: string) { return (raw.prepare(query).get() as T) ?? null; },
    async getAllAsync<T>(query: string) { return raw.prepare(query).all() as T[]; },
  };
  return { raw, sql };
}
function sample(): AppData {
  const d = initialData();
  d.cards.push({ id: "c", createdAt: 1, expression: "figure out", translation: "разобраться", example: "We need to figure out why.", interval: 6, repetition: 2, efactor: 2.5, dueAt: 12345, timezone: "UTC" });
  return d;
}
async function transaction(raw: DatabaseSync, work: () => Promise<void>) {
  raw.exec("BEGIN"); try { await work(); raw.exec("COMMIT"); } catch (e) { raw.exec("ROLLBACK"); throw e; }
}
test("SQLite indexed entities round-trip complete local state", async () => {
  const { sql, raw } = database(); await initializeSqlite(sql);
  const d = sample(); await transaction(raw, () => writeSqlite(sql, d, null));
  assert.deepEqual(await readSqlite(sql), d);
  const indexes = raw.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(x => x.name);
  assert.ok(indexes.includes("card_due")); assert.ok(indexes.includes("material_date")); raw.close();
});
test("migration preserves existing snapshot, dictionary and SM-2 without a reset", async () => {
  const { raw, sql } = database();
  raw.exec("CREATE TABLE app_state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL); PRAGMA user_version=1;");
  const d = sample(); raw.prepare("INSERT INTO app_state VALUES(1,?)").run(JSON.stringify(d));
  await transaction(raw, () => initializeSqlite(sql));
  assert.deepEqual(await readSqlite(sql), d);
  assert.equal((raw.prepare("PRAGMA user_version").get() as { user_version: number }).user_version, 2); raw.close();
});
test("failed multi-table commit rolls back entity and session/progress changes together", async () => {
  const { raw, sql } = database(); await initializeSqlite(sql);
  const before = sample(); await writeSqlite(sql, before, null);
  const after = structuredClone(before); after.cards[0].translation = "изменено";
  const broken: SqlAccess = { ...sql, async runAsync(query, ...params) {
    if (query.startsWith("INSERT INTO app_state")) throw new Error("Simulated disk error");
    return sql.runAsync(query, ...params);
  } };
  await assert.rejects(transaction(raw, () => writeSqlite(broken, after, before)));
  assert.deepEqual(await readSqlite(sql), before); raw.close();
});
test("editing settings does not rewrite unchanged card rows, and deletion persists", async () => {
  const { raw, sql } = database(); await initializeSqlite(sql);
  const before = sample(); await writeSqlite(sql, before, null);
  const after = structuredClone(before); after.settings.bPrompt = "User instruction";
  let cardWrites = 0;
  const counted: SqlAccess = { ...sql, async runAsync(query, ...params) { if (query.startsWith("INSERT INTO cards")) cardWrites++; return sql.runAsync(query, ...params); } };
  await writeSqlite(counted, after, before); assert.equal(cardWrites, 0);
  const deleted = structuredClone(after); deleted.cards = [];
  await writeSqlite(sql, deleted, after); assert.equal((await readSqlite(sql))!.cards.length, 0); raw.close();
});
test("corrupt legacy schema cannot be migrated or silently wiped", async () => {
  const { raw, sql } = database();
  raw.exec("CREATE TABLE app_state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL); PRAGMA user_version=1;");
  raw.prepare("INSERT INTO app_state VALUES(1,?)").run("not JSON");
  await assert.rejects(transaction(raw, () => initializeSqlite(sql)));
  assert.equal((raw.prepare("SELECT payload FROM app_state").get() as { payload: string }).payload, "not JSON"); raw.close();
});
