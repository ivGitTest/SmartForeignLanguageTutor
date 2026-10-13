import React, { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { Body, Button, Card, Heading, Notice } from "./ui";
import { audioFiles } from "../core/audio-files";
import { confirm } from "../core/confirm";
import { repository } from "../core/app-store";

export function Recorder({ disabled }: { disabled: boolean }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status = useAudioRecorderState(recorder, 200);
  const started = useRef(false);
  const stopping = useRef(false);
  const duration = useRef(0);
  const retryDraft = useRef<Awaited<ReturnType<typeof audioFiles.keep>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [interrupted, setInterrupted] = useState(false);
  const stopRef = useRef<(save: boolean) => Promise<void>>(async () => {});
  duration.current = status.isRecording ? status.durationMillis / 1000 : duration.current;
  async function stop(save: boolean) {
    if (!started.current || stopping.current) return;
    started.current = false; stopping.current = true; setBusy(true);
    try {
      const seconds = Math.min(120, Math.max(duration.current, recorder.currentTime));
      if (recorder.isRecording) await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("The recorder did not produce an audio file.");
      if (save) {
        const draft = await audioFiles.keep(uri, seconds);
        retryDraft.current = draft;
        await repository.update(d => { d.pendingAudio = draft; });
        retryDraft.current = null;
      } else await audioFiles.remove(uri);
    } catch {
      setError(retryDraft.current ? "The audio file is retained, but its metadata could not be saved. Retry saving before leaving this screen." : "Could not retain this recording. Check microphone and free storage, then try again.");
    } finally {
      stopping.current = false; setBusy(false);
      await setAudioModeAsync({ allowsRecording: false, shouldPlayInBackground: false }).catch(() => {});
    }
  }
  stopRef.current = stop;
  useEffect(() => {
    if (started.current && !status.isRecording && duration.current > 0.3) void stopRef.current(true);
  }, [status.isRecording]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => {
      if (state !== "active" && started.current) { setInterrupted(true); void stopRef.current(true); }
    });
    return () => listener.remove();
  }, []);
  useFocusEffect(React.useCallback(() => () => { if (started.current) { setInterrupted(true); void stopRef.current(true); } }, []));
  async function start() {
    if (busy || started.current || disabled) return;
    setBusy(true); setError(""); setInterrupted(false);
    try {
      const free = await audioFiles.freeSpace();
      if (free < 12 * 1024 * 1024) throw new Error("Storage space is too low to safely record. Free some space without deleting your existing materials.");
      if (free < 50 * 1024 * 1024 && !await confirm("Low storage", "Less than 50 MiB is free. Recording may fail. Continue without automatically deleting any existing material?")) return;
      if (!repository.snapshot().microphoneNoticeSeen) {
        if (!await confirm("Microphone access", "Record one person speaking English, up to 2 minutes. Audio stays private on this device until you explicitly request transcription.")) return;
        await repository.update(d => { d.microphoneNoticeSeen = true; });
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("Microphone permission is denied. Allow it in Android app settings to record.");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
      await recorder.prepareToRecordAsync();
      duration.current = 0;
      recorder.record({ forDuration: 120 });
      started.current = true;
    } catch (e) { setError(e instanceof Error && /^(Microphone|Storage space)/.test(e.message) ? e.message : "Could not start recording. Check microphone permission and free storage."); }
    finally { setBusy(false); }
  }
  return <Card>
    <Heading small>{status.isRecording ? "Recording…" : "Speak naturally."}</Heading>
    <Body muted>One speaker · English · up to 2 minutes</Body>
    {status.isRecording && <Heading>{Math.floor(status.durationMillis / 60000)}:{String(Math.floor(status.durationMillis / 1000) % 60).padStart(2, "0")}</Heading>}
    {interrupted && <Notice>Recording stopped when the app lost focus. Save or discard the captured fragment.</Notice>}
    {!!error && <Notice error>{error}</Notice>}
    {retryDraft.current ? <Button title="Retry saving recording" disabled={busy} onPress={() => {
      setBusy(true);
      void repository.update(d => { d.pendingAudio = retryDraft.current; }).then(() => { retryDraft.current = null; setError(""); }).catch(() => setError("Local save failed. The audio file is still retained.")).finally(() => setBusy(false));
    }} /> : status.isRecording ? <>
      <Button title="Stop recording" icon="stop" disabled={busy} onPress={() => void stop(true)} />
      <Button title="Discard recording" secondary destructive disabled={busy} onPress={() => void stop(false)} />
    </> : <Button title={busy ? "Preparing…" : "New recording"} icon="mic" disabled={busy || disabled} onPress={() => void start()} />}
  </Card>;
}
