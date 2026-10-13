import { dataSchema, normalizeExpression, type AppData } from "./model";
export interface SqlAccess {
  execAsync(sql: string): Promise<unknown>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  getAllAsync<T>(sql: string): Promise<T[]>;
}
/** Payloads retain the domain schema; indexed entity rows avoid rewriting every card for one edit. */
export async function initializeSqlite(db: SqlAccess) {
  const version = (await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))?.user_version ?? 0;
  if (version > 2) throw new Error("Unsupported database version");
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, audio_uri TEXT, payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS material_date ON materials(created_at DESC);
    CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, due_at INTEGER,
      source_id TEXT, language_pair TEXT NOT NULL CHECK(language_pair='en-ru'),
      expression_search TEXT NOT NULL, translation_search TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS card_due ON cards(due_at);
    CREATE INDEX IF NOT EXISTS card_source ON cards(source_id);
    CREATE INDEX IF NOT EXISTS card_expression ON cards(language_pair,expression_search);
    CREATE INDEX IF NOT EXISTS card_translation ON cards(language_pair,translation_search);
  `);
  if (version < 2) {
    const legacy = await db.getFirstAsync<{ payload: string }>("SELECT payload FROM app_state WHERE id=1");
    if (legacy) {
      const raw = JSON.parse(legacy.payload);
      const data = dataSchema.parse(raw);
      for (const m of data.materials) {
        const before = raw.materials.find((x: { id: string }) => x.id === m.id);
        if (m.translation && before.translationBVersion === undefined) m.translationBVersion = m.bVersion;
        if (m.b && !m.bSourceA && m.bARevision === m.aRevision) m.bSourceA = m.a;
      }
      await writeSqlite(db, data, null);
    }
    await db.execAsync("PRAGMA user_version=2");
  }
}
export async function readSqlite(db: SqlAccess): Promise<AppData | null> {
  const state = await db.getFirstAsync<{ payload: string }>("SELECT payload FROM app_state WHERE id=1");
  const cards = await db.getAllAsync<{ payload: string }>("SELECT payload FROM cards ORDER BY created_at,id");
  const materials = await db.getAllAsync<{ payload: string }>("SELECT payload FROM materials ORDER BY created_at,id");
  if (!state) {
    if (cards.length || materials.length) throw new Error("Local data index is inconsistent. No automatic reset.");
    return null;
  }
  return dataSchema.parse({ ...JSON.parse(state.payload), cards: cards.map(x => JSON.parse(x.payload)), materials: materials.map(x => JSON.parse(x.payload)) });
}
/** Called inside one exclusive transaction: entity changes, session, SM-2 and idempotency events commit together. */
export async function writeSqlite(db: SqlAccess, data: AppData, previous: AppData | null) {
  const oldCards = new Map(previous?.cards.map(c => [c.id, JSON.stringify(c)]) ?? []);
  const oldMaterials = new Map(previous?.materials.map(m => [m.id, JSON.stringify(m)]) ?? []);
  const cardIds = new Set(data.cards.map(c => c.id)), materialIds = new Set(data.materials.map(m => m.id));
  for (const old of oldCards.keys()) if (!cardIds.has(old)) await db.runAsync("DELETE FROM cards WHERE id=?", old);
  for (const old of oldMaterials.keys()) if (!materialIds.has(old)) await db.runAsync("DELETE FROM materials WHERE id=?", old);
  for (const c of data.cards) {
    const payload = JSON.stringify(c);
    if (oldCards.get(c.id) === payload) continue;
    await db.runAsync(`INSERT INTO cards(id,created_at,due_at,source_id,language_pair,expression_search,translation_search,payload)
      VALUES(?,?,?,?,'en-ru',?,?,?) ON CONFLICT(id) DO UPDATE SET created_at=excluded.created_at,
      due_at=excluded.due_at,source_id=excluded.source_id,expression_search=excluded.expression_search,
      translation_search=excluded.translation_search,payload=excluded.payload`,
      c.id, c.createdAt, c.dueAt, c.sourceId ?? null, normalizeExpression(c.expression), c.translation.normalize("NFKC").toLocaleLowerCase("ru"), payload);
  }
  for (const m of data.materials) {
    const payload = JSON.stringify(m);
    if (oldMaterials.get(m.id) === payload) continue;
    await db.runAsync(`INSERT INTO materials(id,created_at,audio_uri,payload) VALUES(?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET created_at=excluded.created_at,audio_uri=excluded.audio_uri,payload=excluded.payload`,
      m.id, m.createdAt, m.audio?.uri ?? null, payload);
  }
  const { cards: _cards, materials: _materials, ...state } = data;
  await db.runAsync("INSERT INTO app_state(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload", JSON.stringify(state));
}
