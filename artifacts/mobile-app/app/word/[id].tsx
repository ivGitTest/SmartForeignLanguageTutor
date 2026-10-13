import React, { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Body, Button, Card, Field, Heading, Notice, Row, Screen, useTask } from "@/components/ui";
import { useApp } from "@/core/app-store";
import { id as newId, normalizeExpression, timezone, type Card as Word } from "@/core/model";
import { skipDeleted } from "@/core/learning";
import { confirm } from "@/core/confirm";
import { speak, stopSpeaking } from "@/core/speech";
import { useFocusEffect } from "expo-router";
import { useUnsavedChanges } from "@/core/unsaved";

export default function WordCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, repo } = useApp();
  const card = data.cards.find(c => c.id === id);
  const isNew = id === "new";
  const [expression, setExpression] = useState(card?.expression ?? "");
  const [translation, setTranslation] = useState(card?.translation ?? "");
  const [example, setExample] = useState(card?.example ?? "");
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedBeforeExit = useRef(false);
  useEffect(() => {
    const current = repo.snapshot().cards.find(c => c.id === id);
    setExpression(current?.expression ?? ""); setTranslation(current?.translation ?? ""); setExample(current?.example ?? "");
    setSaved(false); setDuplicate(null); savedBeforeExit.current = false;
  }, [id, repo]);
  const task = useTask();
  useFocusEffect(React.useCallback(() => () => stopSpeaking(), []));
  useUnsavedChanges(isNew ? !!(expression || translation || example) : !!card && (expression !== card.expression || translation !== card.translation || example !== card.example), savedBeforeExit);
  if (!isNew && !card) return <Screen><Heading small>Card no longer exists</Heading><Button title="Dictionary" onPress={() => router.replace("/")} /></Screen>;
  async function save(separate = false) {
    if (!expression.trim() || !translation.trim()) throw new Error("Expression and translation are required.");
    const found = repo.snapshot().cards.find(c => c.id !== id && normalizeExpression(c.expression) === normalizeExpression(expression));
    if (found && !separate) { setDuplicate(found.id); return; }
    await repo.update(d => {
      const fields = { expression: expression.trim(), translation: translation.trim(), example: example.trim() };
      if (isNew) {
        const word: Word = { ...fields, id: newId(), createdAt: Date.now(), interval: 0, repetition: 0, efactor: 2.5, dueAt: null, timezone: timezone() };
        d.cards.push(word);
      } else {
        const existing = d.cards.find(c => c.id === id);
        if (!existing) throw new Error("This card has been deleted.");
        Object.assign(existing, fields);
      }
    });
    setSaved(true);
    savedBeforeExit.current = true;
    if (isNew) router.replace("/");
  }
  return <Screen>
    <Heading>{isNew ? "Add a word" : "Word card"}</Heading>
    <Card>
      <Field label={`${data.settings.learningLanguage === "en" ? "English" : data.settings.learningLanguage} expression`} value={expression} onChangeText={v => { setExpression(v); setSaved(false); savedBeforeExit.current = false; setDuplicate(null); }} maxLength={500} />
      <Field label={`${card?.sourceId ? "AI translation" : "Translation"} · Russian`} value={translation} onChangeText={v => { setTranslation(v); setSaved(false); savedBeforeExit.current = false; }} multiline maxLength={2000} />
      <Field label={card?.sourceId ? "Example sentence from B" : "Example sentence · optional"} value={example} onChangeText={v => { setExample(v); setSaved(false); savedBeforeExit.current = false; }} multiline maxLength={10000} style={{ minHeight: 100 }} />
      <Button title={task.pending ? "Saving…" : "Save card"} disabled={task.pending} icon="check" onPress={() => void task.run(() => save())} />
      {saved && <Body muted>Saved locally. Learning progress is unchanged.</Body>}
    </Card>
    {duplicate && <Card><Body>This expression is already in your dictionary.</Body><Button title="Open existing card" secondary onPress={() => router.replace(`/word/${duplicate}`)} /><Button title="Save a separate context" onPress={() => void task.run(() => save(true))} /></Card>}
    {!!task.error && <Notice error>{task.error}</Notice>}
    <Button title="Listen in English" secondary icon="volume-up" onPress={() => void task.run(() => speak(expression, task.setError))} disabled={!expression.trim()} />
    {!!card?.sourceId && (data.materials.some(m => m.id === card.sourceId) ? <Button title="Open source material" secondary onPress={() => router.push(`/material/${card.sourceId}`)} /> : <Notice>Source material was deleted. This card and its example are retained.</Notice>)}
    {card && <Card>
      <Body muted>{card.dueAt ? `Next review: ${new Date(card.dueAt).toLocaleString()}` : "New card · not reviewed yet"}</Body>
      <Row><Body muted>Interval {card.interval}d · ease {card.efactor.toFixed(2)}</Body></Row>
      <Button title="Reset learning progress" secondary disabled={task.pending} onPress={() => void task.run(async () => {
        if (!await confirm("Reset progress?", "Keep the word and examples, but reset its SM-2 schedule.")) return;
        await repo.update(d => { const c = d.cards.find(c => c.id === id); if (c) Object.assign(c, { interval: 0, repetition: 0, efactor: 2.5, dueAt: null }); });
      })} />
      <Button title="Delete card" secondary destructive disabled={task.pending} onPress={() => void task.run(async () => {
        if (!await confirm("Delete card?", "This word and its learning progress will be removed. The source material will remain.")) return;
        await repo.update(d => { d.cards = d.cards.filter(c => c.id !== id); skipDeleted(d); });
        savedBeforeExit.current = true;
        router.replace("/");
      })} />
    </Card>}
  </Screen>;
}
