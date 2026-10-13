export type ActiveOperation = { id: number; label: string; materialId?: string };
let sequence = 0;
let active: ActiveOperation | null = null;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();
function emit() { listeners.forEach(l => l()); }
export const operations = {
  snapshot: () => active,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  cancel() { controller?.abort(); controller = null; active = null; sequence++; emit(); },
  async run<T>(label: string, materialId: string | undefined, work: (signal: AbortSignal, guard: () => void) => Promise<T>) {
    if (active) throw new Error("Another AI request is active. Wait or cancel it.");
    const operationId = ++sequence;
    const c = new AbortController();
    controller = c; active = { id: operationId, label, materialId }; emit();
    const guard = () => {
      if (c.signal.aborted || sequence !== operationId) throw new Error("Request cancelled. The provider may still charge for work already started.");
    };
    try { const value = await work(c.signal, guard); guard(); return value; }
    finally { if (sequence === operationId) { controller = null; active = null; emit(); } }
  },
};
