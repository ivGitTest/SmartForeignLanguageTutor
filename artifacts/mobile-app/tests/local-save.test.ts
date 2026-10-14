/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { dataSchema, initialData, MAX_RECORDING_SIZE_BYTES } from "../core/model";
import { Repository } from "../core/repository";
import { localSaveFailure, recordingSaveMessage } from "../core/local-save-error";
import { isValidRecordingFileSize, recordingDuration, repairPendingAudioMetadata } from "../core/recording-metadata";

test("local save diagnostics distinguish database failures without exposing raw details", () => {
  for (const [nativeMessage, code] of [
    ["database is locked", "SQLITE_BUSY"],
    ["database or disk is full", "SQLITE_FULL"],
    ["attempt to write a readonly database (SQLITE_READONLY)", "SQLITE_READONLY"],
    ["disk I/O error", "SQLITE_IOERR"],
    ["database disk image is malformed", "SQLITE_CORRUPT"],
    ["unable to open database file", "SQLITE_CANTOPEN"],
  ]) {
    const cause = new Error(`${nativeMessage}; private-path-and-payload`);
    const error = localSaveFailure(cause);
    assert.equal(error.code, code);
    assert.equal(error.cause, cause);
    assert.ok(!error.message.includes("private-path-and-payload"));
    assert.match(recordingSaveMessage(error), /audio file is still retained/);
  }
  assert.equal(localSaveFailure(new Error("unknown failure: private data")).code, "DB_WRITE_FAILED");
  assert.ok(!localSaveFailure(new Error("unknown failure: private data")).message.includes("private data"));
});

test("invalid recording metadata reports field names but no private values", () => {
  const invalid = dataSchema.safeParse({
    ...initialData(),
    pendingAudio: { uri: "private-uri", duration: 2, size: null, createdAt: 1 },
  });
  assert.equal(invalid.success, false);
  if (invalid.success) throw new Error("Expected invalid metadata");
  const message = recordingSaveMessage(invalid.error);
  assert.match(message, /INVALID_LOCAL_DATA/);
  assert.match(message, /pendingAudio.size/);
  assert.ok(!message.includes("private-uri"));
});

test("pending recording uses a validated source size and repairs the retained-file recovery marker", () => {
  const actualSize = 2048;
  assert.equal(isValidRecordingFileSize(actualSize), true);
  assert.equal(isValidRecordingFileSize(0), false);
  assert.equal(isValidRecordingFileSize(1.5), false);
  assert.equal(isValidRecordingFileSize(Number.NaN), false);
  assert.equal(isValidRecordingFileSize(MAX_RECORDING_SIZE_BYTES + 1), false);

  const oldMarker = {
    uri: "file:///private/recordings/recording.m4a",
    duration: 2,
    size: null,
    createdAt: 1,
  };
  const repaired = repairPendingAudioMetadata(oldMarker, actualSize);
  assert.equal(repaired?.size, actualSize);
  assert.equal(repairPendingAudioMetadata(oldMarker, Number.NaN), null);
  assert.equal(repairPendingAudioMetadata({ ...oldMarker, duration: Number.NaN }, actualSize), null);
  assert.equal(dataSchema.safeParse({ ...initialData(), pendingAudio: repaired }).success, true);
});

test("recording timing ignores unavailable native samples and respects duration limit", () => {
  assert.equal(recordingDuration(2.3, NaN), 2.3);
  assert.equal(recordingDuration(Infinity, 4.2), 4.2);
  assert.equal(recordingDuration(2, -1), 2);
  assert.equal(recordingDuration(125, 124), 120);
  assert.ok(Number.isNaN(recordingDuration(NaN, -1)));
  assert.ok(Number.isNaN(recordingDuration(0, Infinity)));
});

test("failed pending recording metadata save preserves state and can retry the same draft", async () => {
  let saved = JSON.stringify(initialData());
  let fail = false;
  const repo = new Repository({
    async read() { return saved; },
    async write(value) {
      if (fail) throw new Error("SQLITE_BUSY");
      saved = value;
    },
  });
  await repo.hydrate();
  const draft = { uri: "file:///private/recording.m4a", size: 1024, duration: 2, createdAt: 1 };
  fail = true;
  await assert.rejects(repo.update(data => { data.pendingAudio = draft; }), /SQLITE_BUSY/);
  assert.equal(repo.snapshot().pendingAudio, null);
  assert.equal(JSON.parse(saved).pendingAudio, null);
  fail = false;
  await repo.update(data => { data.pendingAudio = draft; });
  assert.deepEqual(repo.snapshot().pendingAudio, draft);
  assert.deepEqual(JSON.parse(saved).pendingAudio, draft);
});
