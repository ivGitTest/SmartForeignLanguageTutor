import { repository } from "./app-store";
import { operations } from "./operations";
import { flushDeletedFiles } from "./file-maintenance";
export async function deleteMaterial(id: string, audioOnly: boolean) {
  if (operations.snapshot()?.materialId === id) operations.cancel();
  const uri = repository.snapshot().materials.find(m => m.id === id)?.audio?.uri;
  await repository.update(d => {
    if (uri) d.pendingFileDeletes.push(uri);
    if (audioOnly) { const m = d.materials.find(m => m.id === id); if (m) m.audio = null; }
    else { d.materials = d.materials.filter(m => m.id !== id); if (d.lastMaterialId === id) d.lastMaterialId = null; }
  });
  try { await flushDeletedFiles(repository); }
  catch { throw new Error("The material change was saved. Private audio cleanup is pending and will be retried on the next app launch."); }
}
