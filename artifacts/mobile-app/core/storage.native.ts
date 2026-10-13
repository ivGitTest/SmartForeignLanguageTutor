import * as SQLite from "expo-sqlite";
import type { Persistence } from "./repository";
import { dataSchema, type AppData } from "./model";
import { initializeSqlite, readSqlite, writeSqlite } from "./sqlite-snapshot";

let connection: Promise<SQLite.SQLiteDatabase> | undefined;
async function db() {
  connection ??= (async () => {
    const db = await SQLite.openDatabaseAsync("smart-lang-tutor.db");
    await db.execAsync("PRAGMA journal_mode = WAL;");
    await db.withExclusiveTransactionAsync(initializeSqlite);
    return db;
  })();
  return connection;
}
let previous: AppData | null = null;
export const persistence: Persistence = {
  async read() { previous = await readSqlite(await db()); return previous ? JSON.stringify(previous) : null; },
  async write(value) {
    const data = dataSchema.parse(JSON.parse(value));
    await (await db()).withExclusiveTransactionAsync(async tx => {
      await writeSqlite(tx, data, previous);
    });
    previous = data;
  },
};
