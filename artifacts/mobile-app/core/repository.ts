import { dataSchema, initialData, type AppData } from "./model";
import { localSaveFailure } from "./local-save-error";

export interface Persistence {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}
/** Serialized, durable mutations. A failed write never changes the visible state. */
export class Repository {
  private data = initialData();
  private listeners = new Set<() => void>();
  private tail: Promise<unknown> = Promise.resolve();
  private hydration: Promise<void> | undefined;
  constructor(private persistence: Persistence) {}
  snapshot = () => this.data;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  hydrate() {
    this.hydration ??= this.open();
    return this.hydration;
  }
  private async open() {
    const saved = await this.persistence.read();
    if (saved !== null) this.data = dataSchema.parse(JSON.parse(saved));
    else await this.persistence.write(JSON.stringify(this.data));
    this.listeners.forEach(l => l());
  }
  update<T>(mutate: (draft: AppData) => T): Promise<T> {
    const pending = this.tail.then(async () => {
      const draft: AppData = JSON.parse(JSON.stringify(this.data));
      const result = mutate(draft);
      dataSchema.parse(draft);
      try { await this.persistence.write(JSON.stringify(draft)); }
      catch (error) { throw localSaveFailure(error); }
      this.data = draft;
      this.listeners.forEach(l => l());
      return result;
    });
    this.tail = pending.catch(() => {});
    return pending;
  }
}
