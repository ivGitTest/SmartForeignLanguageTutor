import type { Repository } from "./repository";
import { audioFiles } from "./audio-files";
/** Database deletion is durable first; private file cleanup is safely retryable after a crash. */
export async function flushDeletedFiles(repo: Repository) {
  for (const uri of repo.snapshot().pendingFileDeletes) {
    await audioFiles.remove(uri);
    await repo.update(d => { d.pendingFileDeletes = d.pendingFileDeletes.filter(value => value !== uri); });
  }
}
