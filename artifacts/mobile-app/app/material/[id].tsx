import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Body, Busy, Button, Card, Field, Heading, IconButton, Label, Notice, Row, Screen, useTask } from "@/components/ui";
import { AudioPlayer } from "@/components/audio-player";
import { Disclosure } from "@/components/disclosure";
import { SelectableTranscript } from "@/components/selectable-transcript";
import { useApp } from "@/core/app-store";
import { bIsStale, translationIsStale, id as newId, normalizeExpression, timezone } from "@/core/model";
import { generateA, generateB, retryTranslation, translateExpression } from "@/core/actions";
import { operations } from "@/core/operations";
import { deleteMaterial } from "@/core/material-delete";
import { confirm } from "@/core/confirm";
import { speak, stopSpeaking } from "@/core/speech";

type Selection = { expression: string; sentence: string; text: string };
export default function MaterialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, repo, active } = useApp();
  const m = data.materials.find(m => m.id === id);
  const task = useTask();
  const [a, setA] = useState(m?.a ?? "");
  const [title, setTitle] = useState(m?.title ?? "");
  const [saveCount, setSaveCount] = useState(0);
  const saveRef = useRef(0);
  const [saveError, setSaveError] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectionRef = useRef(0);
  const [contextTranslation, setContextTranslation] = useState("");
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  useEffect(() => { if (m && !saveRef.current && !m.aEdited) setA(m.a); }, [m?.aRevision, m?.aEdited]);
  useEffect(() => { if (m) void repo.update(d => { d.lastMaterialId = id; }).catch(() => setSaveError("Could not save the current material position.")); }, [id]);
  useFocusEffect(React.useCallback(() => () => { stopSpeaking(); }, []));
  useEffect(() => {
    selectionRef.current++;
    setSelection(null); setContextTranslation(""); setDuplicate(null); setAdded(false);
  }, [m?.bVersion, m?.aRevision]);
  if (!m) return <Screen><Heading small>Material no longer exists</Heading><Button title="Materials" onPress={() => router.replace("/materials")} /></Screen>;
  const stale = bIsStale(m, data.settings);
  const busy = !!active || task.pending || !!saveCount;
  async function saveA(value: string) {
    setA(value); setSaveError("");
    if (operations.snapshot()?.materialId === id) operations.cancel();
    saveRef.current++; setSaveCount(saveRef.current);
    try {
      await repo.update(d => {
        const material = d.materials.find(x => x.id === id);
        if (!material) throw new Error("This material was deleted.");
        if (material.a !== value) { material.a = value; material.aRevision++; material.aEdited = true; }
      });
    } catch { setSaveError("A could not be saved. Your draft is still shown below. Retry saving before leaving."); }
    finally { saveRef.current--; setSaveCount(saveRef.current); }
  }
  function select(expression: string, sentence: string) {
    if (selection?.expression === expression && selection.text === m!.b) return;
    selectionRef.current++;
    setSelection({ expression, sentence, text: m!.b });
    setContextTranslation(""); setDuplicate(null); setAdded(false);
  }
  async function addCard(separate = false) {
    if (!selection || !contextTranslation) return;
    const latest = repo.snapshot();
    const source = latest.materials.find(x => x.id === id);
    if (!source || source.b !== selection.text || bIsStale(source, latest.settings)) throw new Error("B changed. Select and translate the expression again.");
    const existing = latest.cards.find(c => normalizeExpression(c.expression) === normalizeExpression(selection.expression));
    if (existing && !separate) { setDuplicate(existing.id); return; }
    await repo.update(d => {
      const source = d.materials.find(x => x.id === id);
      if (!source || source.b !== selection.text) throw new Error("The source material changed or was removed.");
      d.cards.push({ id: newId(), createdAt: Date.now(), expression: selection.expression, translation: contextTranslation, example: selection.sentence,
        sourceId: id, interval: 0, repetition: 0, efactor: 2.5, dueAt: null, timezone: timezone() });
    });
    setAdded(true); setDuplicate(null);
  }
  return <Screen>
    <View><Label>AUDIO → A → B → TRANSLATION</Label><Heading>Make it your own.</Heading></View>
    <Card>
      <Field label="Material title" value={title} onChangeText={setTitle} maxLength={160} />
      {title !== m.title && <Button title="Save title" secondary disabled={task.pending} onPress={() => void task.run(() => repo.update(d => {
        if (!title.trim()) throw new Error("Enter a title.");
        const material = d.materials.find(x => x.id === id); if (material) material.title = title.trim();
      }))} />}
      <Body muted>{new Date(m.createdAt).toLocaleString("en-GB")}{m.audio ? ` · ${Math.round(m.audio.duration)}s` : ""}</Body>
      {m.audio ? <AudioPlayer uri={m.audio.uri} /> : <Notice>Audio was removed. Your saved texts are retained; re-transcription is unavailable.</Notice>}
      <Button title={m.a ? "Transcribe again · A" : "Transcribe · A"} icon="notes" disabled={busy || !m.audio} onPress={() => void task.run(async () => {
        if (m.aEdited && !await confirm("Replace edited A?", "Your manual edits will be replaced only if transcription succeeds. B and Translation will then be marked out of date.")) return;
        await generateA(id);
      })} />
    </Card>
    {!!m.a && <Card>
      <Row><Heading small>A · Original</Heading><IconButton name="volume-up" label="Listen to A" onPress={() => void task.run(() => speak(a, task.setError))} /></Row>
      {!!m.aModelUsed && <Body muted style={{ fontSize: 11 }}>{m.aModelUsed} · {new Date(m.aCreatedAt).toLocaleString("en-GB")}{m.aEdited ? " · edited" : ""}</Body>}
      <Body muted>Verbatim transcription. Edit it before improving.</Body>
      <Field label="A · editable transcript" value={a} multiline style={{ minHeight: 150 }} maxLength={10000}
        onChangeText={v => void saveA(v)} />
      <Body muted style={{ fontSize: 12 }}>{saveCount ? "Saving A…" : saveError ? "Draft not saved" : "A saved locally"}</Body>
      {!!saveError && <><Notice error>{saveError}</Notice><Button title="Retry saving A" secondary onPress={() => void saveA(a)} /></>}
      <Button title={m.b ? "Improve again · B2" : "Improve to B2 · B"} disabled={busy || !m.a.trim() || a !== m.a || !!saveError} icon="auto-fix-high" onPress={() => void task.run(() => generateB(id))} />
    </Card>}
    {!!m.b && <Card>
      <Row><Heading small>B · Improved</Heading><IconButton name="volume-up" label="Listen to B" onPress={() => void task.run(() => speak(m.b, task.setError))} /></Row>
      <Body muted>B2 English · select a word or expression to translate it.</Body>
      {!!m.bModelUsed && <Body muted style={{ fontSize: 11 }}>{m.bModelUsed} · {new Date(m.bCreatedAt).toLocaleString("en-GB")}</Body>}
      {stale && <Notice>B is out of date after changes to A or its AI settings. Improve A again to create a new B.</Notice>}
      <SelectableTranscript text={m.b} onSelect={(expression, sentence) => { if (!stale) select(expression, sentence); }} />
      <Disclosure key={`translation-${m.bVersion}`} label={`Translation · Russian · ${m.translation ? "Saved" : m.translationError ? "Error" : "Not created"}`}>
        {m.translation ? <><Body
          accessibilityLabel="Russian translation"
          selectable
          style={{ width: "100%", maxWidth: "100%", minWidth: 0, flexShrink: 1, alignSelf: "stretch" }}
        >{m.translation}</Body>{translationIsStale(m, data.settings) && <Notice>Translation is out of date.</Notice>}</> : <Body muted>{active?.materialId === id ? "Translation is being requested after B." : "Translation has not been created yet."}</Body>}
        {!!m.translationError && <Notice error>{m.translationError}</Notice>}
        <Button title={m.translation ? "Translate again" : "Retry Translation"} secondary disabled={busy || stale} onPress={() => void task.run(() => retryTranslation(id))} />
      </Disclosure>
    </Card>}
    {selection && <Card>
      <Row><Heading small>{selection.expression}</Heading><IconButton name={added ? "bookmark" : "bookmark-add"} label={added ? "Added to Dictionary" : "Add expression to Dictionary"} disabled={!contextTranslation || busy || added} onPress={() => void task.run(() => addCard())} /></Row>
      {contextTranslation ? <Body>{contextTranslation}</Body> : <Button title="Translate selection" secondary disabled={busy} onPress={() => void task.run(async () => {
        const version = selectionRef.current;
        const result = await translateExpression(id, selection.expression, selection.sentence, selection.text, "b");
        if (version === selectionRef.current) setContextTranslation(result);
      })} />}
      {added && <Body muted>Added to Dictionary. You can edit it there.</Body>}
      {duplicate && <><Notice>This expression is already in Dictionary.</Notice><Button title="Open existing card" secondary onPress={() => router.push(`/word/${duplicate}`)} /><Button title="Add a separate context" disabled={busy} onPress={() => void task.run(() => addCard(true))} /></>}
    </Card>}
    {!!m.incomplete && <Disclosure label="Incomplete B attempt · not applied"><Body selectable>{m.incomplete}</Body></Disclosure>}
    {active?.materialId === id && <><Busy label={active.label} /><Button title="Cancel request" secondary onPress={() => operations.cancel()} /><Body muted style={{ fontSize: 12 }}>Cancellation does not guarantee that the provider stops processing or billing.</Body></>}
    {!!task.error && <Notice error>{task.error}</Notice>}
    {!!m.lastAIError && m.lastAIError !== task.error && <Notice error>{m.lastAIError}</Notice>}
    {!!(m.a || m.b) && <Body muted style={{ fontSize: 12 }}>{m.costKnown ? `Reported AI charges received: $${m.cost.toFixed(6)}.` : "AI cost was not provided by the service."} Other attempts with unknown cost, failed or cancelled requests may also be billed.</Body>}
    <Disclosure label="Delete options">
      {!!m.a && <Button title="Delete A and dependent texts" secondary destructive disabled={task.pending} onPress={() => void task.run(async () => {
        if (!await confirm("Delete A?", "Delete A, B and Translation. Keep audio and dictionary cards.")) return;
        if (operations.snapshot()?.materialId === id) operations.cancel();
        await repo.update(d => { const source = d.materials.find(x => x.id === id); if (source) {
          source.a = ""; source.aRevision++; source.aEdited = false; source.b = ""; source.bVersion++; source.translation = ""; source.translationError = ""; source.incomplete = "";
        } });
        setA("");
      })} />}
      {!!m.b && <Button title="Delete B and Translation" secondary destructive disabled={task.pending} onPress={() => void task.run(async () => {
        if (!await confirm("Delete B?", "Delete B and its Translation. Keep A, audio and dictionary cards.")) return;
        if (operations.snapshot()?.materialId === id) operations.cancel();
        await repo.update(d => { const source = d.materials.find(x => x.id === id); if (source) {
          source.b = ""; source.bVersion++; source.translation = ""; source.translationError = ""; source.incomplete = "";
        } });
      })} />}
      {!!m.translation && <Button title="Delete Translation only" secondary destructive disabled={task.pending} onPress={() => void task.run(async () => {
        if (!await confirm("Delete Translation?", "Keep B, A, audio and all dictionary cards.")) return;
        if (operations.snapshot()?.materialId === id) operations.cancel();
        await repo.update(d => { const source = d.materials.find(x => x.id === id); if (source) { source.translation = ""; source.translationFingerprint = ""; source.translationError = ""; } });
      })} />}
      {m.audio && <Button title="Delete audio only" secondary destructive disabled={task.pending} onPress={() => void task.run(async () => {
        if (!await confirm("Delete audio?", "A, B, Translation and dictionary cards will remain. The audio cannot be recovered.")) return;
        await deleteMaterial(id, true);
      })} />}
      <Button title="Delete material and texts" secondary destructive disabled={task.pending} onPress={() => void task.run(async () => {
        if (!await confirm("Delete this material?", "Audio, A, B and Translation will be removed from this device. Dictionary cards will remain. Provider copies are not deleted.")) return;
        await deleteMaterial(id, false); router.replace("/materials");
      })} />
    </Disclosure>
  </Screen>;
}
