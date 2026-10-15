import React, { useEffect } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Body, Button, Card, Heading, Label, Notice, Row, Screen, useTask } from "@/components/ui";
import type { ButtonTone } from "@/components/ui";
import { useApp } from "@/core/app-store";
import { eligible, GRADES, rate, startSession } from "@/core/learning";
import { speak, stopSpeaking } from "@/core/speech";
import { useColors } from "@/hooks/useColors";

const gradeTones: Record<(typeof GRADES)[number]["label"], ButtonTone> = {
  Again: "again",
  Hard: "hard",
  Good: "good",
  Easy: "easy",
};

export default function Learning() {
  const { data, repo } = useApp();
  const c = useColors();
  const task = useTask();
  useEffect(() => { if (!repo.snapshot().session && eligible(repo.snapshot().cards).length) void task.run(() => repo.update(d => startSession(d))); }, [repo]);
  useFocusEffect(React.useCallback(() => () => { stopSpeaking(); }, []));
  const session = data.session;
  const card = session && data.cards.find(c => c.id === session.ids[session.index]);
  if (!session) return <Screen><Label>A LITTLE, EVERY DAY</Label><Heading>Learning</Heading><Card><Heading small>{data.cards.length ? "All caught up" : "No cards yet"}</Heading><Body muted>{data.cards.length ? "There are no new or due cards. Your saved schedule will bring them back when they are due." : "Add words in Dictionary or from an improved material to start a session."}</Body><Button title="Open Dictionary" onPress={() => router.push("/")} /></Card>{!!task.error && <Notice error>{task.error}</Notice>}</Screen>;
  if (session.index >= session.ids.length) return <Screen><Label>SESSION COMPLETE</Label><Heading>Nicely done.</Heading><Card><Heading small>{session.ratings.length} cards reviewed</Heading><Body muted>Your progress is saved on this device.</Body><Body>Again {session.ratings.filter(r => r.quality === 0).length} · Hard {session.ratings.filter(r => r.quality === 3).length} · Good {session.ratings.filter(r => r.quality === 4).length} · Easy {session.ratings.filter(r => r.quality === 5).length}</Body></Card>
    <Button title="Continue learning" disabled={task.pending} onPress={() => void task.run(() => repo.update(d => { d.session = null; startSession(d); }))} />
    <Button title="Exit to Dictionary" secondary onPress={() => router.push("/")} />
    {!!task.error && <Notice error>{task.error}</Notice>}
  </Screen>;
  if (!card) return <Screen><Notice>This card was removed from the session.</Notice></Screen>;
  return <Screen>
    <Label>A LITTLE, EVERY DAY</Label><Row><Heading>Learning</Heading><Body muted>{session.index + 1} / {session.ids.length}</Body></Row>
    <View accessibilityLabel="Session progress" style={{ height: 5, borderRadius: 4, backgroundColor: c.border }}><View style={{ height: 5, width: `${session.index / session.ids.length * 100}%`, backgroundColor: c.primary, borderRadius: 4 }} /></View>
    <Card style={{ minHeight: 280, justifyContent: "center", padding: 26 }}>
      <Label>ENGLISH</Label><Heading>{card.expression}</Heading>
      {session.revealed && <><Body style={{ fontSize: 21, lineHeight: 29 }}>{card.translation}</Body>{!!card.example && <Body muted>{card.example}</Body>}</>}
    </Card>
    <Button title="Listen" icon="volume-up" secondary onPress={() => void task.run(() => speak(card.expression, task.setError))} />
    {!session.revealed ? <Button title="Show answer" disabled={task.pending} onPress={() => void task.run(() => repo.update(d => { if (d.session?.id === session.id && d.session.index === session.index) d.session.revealed = true; }))} /> :
      <View style={{ gap: 10 }}><Body muted>How well did you remember?</Body><Row style={{ flexWrap: "wrap" }}>{GRADES.map(grade => <View key={grade.label} style={{ width: "47%" }}><Button title={grade.label} tone={gradeTones[grade.label]} disabled={task.pending} onPress={() => void task.run(() => repo.update(d => rate(d, session.id, card.id, grade.quality)))} /></View>)}</Row></View>}
    {!!task.error && <Notice error>{task.error}</Notice>}
    <Body muted style={{ fontSize: 12 }}>Saved after every answer. You can switch modes and continue later. New words join the next session.</Body>
  </Screen>;
}
