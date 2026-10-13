import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { Repository } from "./repository";
import { persistence } from "./storage";
import { operations } from "./operations";
import { audioFiles } from "./audio-files";
import { flushDeletedFiles } from "./file-maintenance";

export const repository = new Repository(persistence);
const StoreContext = createContext(repository);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [recoveryError, setRecoveryError] = useState(false);
  useEffect(() => {
    let alive = true;
    repository.hydrate().then(async () => {
      // A malformed recovery marker must not prevent opening the valid dictionary/database.
      let recovery = null;
      try { recovery = await audioFiles.recover(); }
      catch { if (alive) setRecoveryError(true); }
      if (repository.snapshot().materials.some(m => m.pendingAI)) await repository.update(d => {
        for (const m of d.materials) if (m.pendingAI) {
          m.pendingAI = null;
          m.lastAIError = "The previous AI request did not finish on this device. Saved results were kept. It may have been billed; retry explicitly.";
        }
      });
      if (recovery && !repository.snapshot().pendingAudio && !repository.snapshot().materials.some(m => m.audio?.uri === recovery.uri) && !repository.snapshot().pendingFileDeletes.includes(recovery.uri)) {
        await repository.update(d => { d.pendingAudio = recovery; });
      }
      if (alive) setLoaded(true);
      // A cleanup failure must not hide valid saved data or trigger a database reset.
      void flushDeletedFiles(repository).catch(() => {});
    }).catch(() => { if (alive) setError(true); });
    const subscription = AppState.addEventListener("change", state => { if (state !== "active") operations.cancel(); });
    return () => { alive = false; subscription.remove(); };
  }, []);
  if (error) return <View style={{ flex: 1, justifyContent: "center", padding: 30 }}><Text>Local data could not be opened. No data has been reset or deleted. Restart the app; if this continues, stop using it and contact the developer.</Text></View>;
  if (!loaded) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator accessibilityLabel="Opening local data" /></View>;
  return <StoreContext.Provider value={repository}><View style={{ flex: 1 }}>
    {recoveryError && <Text style={{ padding: 16, backgroundColor: "#f8e9df", color: "#243b39" }}>Saved data opened, but a temporary recording could not be recovered. Other materials and dictionary cards are unchanged.</Text>}
    {children}
  </View></StoreContext.Provider>;
}
export function useApp() {
  const repo = useContext(StoreContext);
  const data = useSyncExternalStore(repo.subscribe, repo.snapshot, repo.snapshot);
  const active = useSyncExternalStore(operations.subscribe, operations.snapshot, operations.snapshot);
  return { data, repo, active };
}
