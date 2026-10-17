import React, { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { Body, Button, Card, Field, Heading, Notice, Row, useTask } from "@/components/ui";
import { Recorder } from "@/components/recorder";
import { AudioPlayer } from "@/components/audio-player";
import { useApp } from "@/core/app-store";
import { audioFiles } from "@/core/audio-files";
import { id, type Material } from "@/core/model";
import { useColors } from "@/hooks/useColors";
import { flushDeletedFiles } from "@/core/file-maintenance";
import { formatRecordingTitle, titleForMaterial } from "@/core/recording-title";

export default function Materials() {
  const { data, repo, active } = useApp();
  const c = useColors();
  const [query, setQuery] = useState("");
  const task = useTask();
  const materials = data.materials.filter(m => `${titleForMaterial(m)} ${m.a} ${m.b}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => b.createdAt - a.createdAt);
  async function saveRecording() {
    const materialId = id();
    await repo.update(d => {
      if (!d.pendingAudio) throw new Error("No recording is awaiting save.");
      const { createdAt, ...audio } = d.pendingAudio;
      const m: Material = { id: materialId, createdAt, title: formatRecordingTitle(createdAt, audio.duration), audio,
        a: "", aRevision: 0, aEdited: false, b: "", bARevision: 0, bFingerprint: "", bVersion: 0, bModelUsed: "", bCreatedAt: 0, bCEFRPair: d.settings.cefrPair,
        translation: "", translationFingerprint: "", translationLanguage: "ru", translationError: "", incomplete: "", cost: 0, costKnown: false, pendingAI: null, lastAIError: "",
        aModelUsed: "", aCreatedAt: 0, aTemperatureUsed: 0, bSourceA: "", translationBVersion: 0, translationCreatedAt: 0 };
      d.materials.push(m); d.pendingAudio = null; d.lastMaterialId = materialId;
    });
    await audioFiles.clearRecovery();
    router.push(`/material/${materialId}`);
  }
  return <FlatList data={materials} keyExtractor={m => m.id} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 10, width: "100%", maxWidth: 640, alignSelf: "center" }}
    ListHeaderComponent={<View style={{ gap: 18, paddingBottom: 8 }}>
      <View><Heading>Materials</Heading></View>
      <Recorder disabled={!!active || task.pending || !!data.pendingAudio} visible={!data.pendingAudio} />
      {data.pendingAudio ? <Card><Heading small>Keep this recording?</Heading><Body muted>{data.pendingAudio.duration.toFixed(1)}s · {(data.pendingAudio.size / 1024).toFixed(0)} KiB</Body>
        <AudioPlayer uri={data.pendingAudio.uri} />
        <Button title="Save recording" disabled={task.pending} icon="check" onPress={() => void task.run(saveRecording)} />
        <Button title="Discard recording" secondary destructive disabled={task.pending} onPress={() => void task.run(async () => {
          const uri = repo.snapshot().pendingAudio?.uri;
          await repo.update(d => { if (uri) d.pendingFileDeletes.push(uri); d.pendingAudio = null; });
          await audioFiles.clearRecovery();
          await flushDeletedFiles(repo);
        })} />
      </Card> : null}
      {!!task.error && <Notice error>{task.error}</Notice>}
      {active && <Notice>{active.label}. You can switch modes; keep the app in the foreground.</Notice>}
    {data.lastMaterialId && data.materials.some(m => m.id === data.lastMaterialId) && <Button title="Continue last material" secondary onPress={() => router.push(`/material/${data.lastMaterialId}`)} />}
    {!!data.pendingFileDeletes.length && <Notice>Private audio cleanup is pending. It will be retried on the next launch; your other recordings are untouched.</Notice>}
      <Row><Body style={{ fontFamily: "DMSans_700Bold" }}>Your materials · {data.materials.length}</Body><Body muted style={{ fontSize: 12 }}>Newest first</Body></Row>
      <View>{/* Search is local and never sends other materials to the provider. */}
        <Search value={query} change={setQuery} />
      </View>
      <View style={{ height: 1, backgroundColor: c.border }} />
    </View>}
    renderItem={({ item }) => {
      const title = titleForMaterial(item);
      const attributes = [item.audio && "Audio", item.a && "A", item.b && "B", item.translation && "Translation"].filter(Boolean).join(" · ");
      return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={() => { void repo.update(d => { d.lastMaterialId = item.id; }); router.push(`/material/${item.id}`); }}>
        <Card style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 4 }}>
          <Row><Body numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, fontFamily: "DMSans_700Bold" }}>{title}</Body><MaterialIcons name="chevron-right" size={20} color={c.mutedForeground} /></Row>
          <Row style={{ gap: 6, justifyContent: "flex-end" }}>
            <Body accessibilityLabel={`Available content for ${title}: ${attributes}`} muted numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 10, lineHeight: 14, textAlign: "right" }}>{attributes}</Body>
          </Row>
        </Card>
      </Pressable>;
    }}
    ListEmptyComponent={<Card><Heading small>{query ? "No matching materials" : "A place for your English"}</Heading><Body muted>{query ? "Try another word or clear the search." : "Your recordings and their linked texts will appear here. Nothing is uploaded until you choose an AI action."}</Body></Card>}
  />;
}
function Search({ value, change }: { value: string; change: (v: string) => void }) { return <Field label="Search materials" labelHidden placeholder="Search titles or texts" value={value} onChangeText={change} />; }
