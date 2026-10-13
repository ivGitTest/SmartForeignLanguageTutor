import { ZodError } from "zod";

export class LocalSaveError extends Error {
  constructor(readonly code: string, guidance: string, cause: unknown) {
    super(`Local save failed [${code}]. ${guidance} Your previous saved data is unchanged.`, { cause });
    this.name = "LocalSaveError";
  }
}

/** Only expose recognized codes, never SQL bindings, file paths or user data. */
export function localSaveFailure(cause: unknown): LocalSaveError {
  const message = cause instanceof Error ? cause.message : "";
  const nativeCode = cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string" ? cause.code : "";
  const diagnostic = `${nativeCode} ${message}`;
  if (/SQLITE_FULL|database or disk is full|ENOSPC/i.test(diagnostic))
    return new LocalSaveError("SQLITE_FULL", "Private app storage is full. Free device space and retry.", cause);
  if (/SQLITE_BUSY|SQLITE_LOCKED|database (?:table )?is locked/i.test(diagnostic))
    return new LocalSaveError("SQLITE_BUSY", "The local database is busy. Wait a few seconds and retry.", cause);
  if (/SQLITE_READONLY|read.?only database/i.test(diagnostic))
    return new LocalSaveError("SQLITE_READONLY", "The private app database is read-only. Restart the app and retry; a shared-storage permission will not fix this.", cause);
  if (/SQLITE_CORRUPT|SQLITE_NOTADB|database disk image is malformed|file is not a database/i.test(diagnostic))
    return new LocalSaveError("SQLITE_CORRUPT", "The local database is unreadable. Do not clear app data; contact the developer.", cause);
  if (/SQLITE_IOERR|disk I\/O error/i.test(diagnostic))
    return new LocalSaveError("SQLITE_IOERR", "Writing the private app database failed. Restart the app and retry.", cause);
  if (/SQLITE_CANTOPEN|unable to open database/i.test(diagnostic))
    return new LocalSaveError("SQLITE_CANTOPEN", "The private app database could not be opened. Restart the app and retry.", cause);
  const code = diagnostic.match(/\bSQLITE_[A-Z_]+\b/)?.[0] ?? "DB_WRITE_FAILED";
  return new LocalSaveError(code, "The local database rejected the save. Keep this screen open and retry. If it repeats, send this diagnostic code to the developer.", cause);
}

/** Used only once keep() succeeded: its private file and recovery marker exist. */
export function recordingSaveMessage(error: unknown): string {
  let detail: string;
  if (error instanceof LocalSaveError) detail = error.message;
  else if (error instanceof ZodError) {
    const fields = [...new Set(error.issues.map(issue => issue.path.join(".")))].slice(0, 4);
    detail = `Local save failed [INVALID_LOCAL_DATA]. Invalid metadata fields: ${fields.join(", ")}.`;
  } else detail = "Local save failed [RECORDING_METADATA_FAILED]. The recording metadata could not be saved. Retry; if it repeats, send this code to the developer.";
  return `${detail} The audio file is still retained. Do not clear app data or uninstall the app.`;
}
