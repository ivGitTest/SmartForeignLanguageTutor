import React, { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { Body, Button, Card, Field, Heading, Label, Notice, Row, useTask } from "@/components/ui";
import { useApp } from "@/core/app-store";
import { eligible, startSession } from "@/core/learning";
import { useColors } from "@/hooks/useColors";

export default function Dictionary() {
  const { data, repo } = useApp();
  const c = useColors();
  const [query, setQuery] = useState("");
  const task = useTask();
  const words = data.cards.filter(word => `${word.expression} ${word.translation}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => b.createdAt - a.createdAt);
  const remaining = data.session && data.session.index < data.session.ids.length;
  const count = eligible(data.cards).length;
  return <FlatList data={words} keyExtractor={item => item.id} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
    style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, paddingBottom: 30, width: "100%", maxWidth: 640, alignSelf: "center" }}
    ListHeaderComponent={<View style={{ gap: 17, paddingBottom: 14 }}>
      <View><Label>YOUR EVERYDAY ENGLISH</Label><Heading>Dictionary</Heading></View>
      <Button title={remaining ? "Resume learning" : `Start learning${count ? ` · ${count} cards` : ""}`} icon="school" disabled={!remaining && !count} onPress={() => void task.run(async () => { await repo.update(d => startSession(d)); router.push("/learning"); })} />
      <Row><View><Body style={{ fontFamily: "DMSans_700Bold" }}>Your vocabulary · {data.cards.length}</Body><Body muted style={{ fontSize: 12 }}>English → Russian</Body></View><Button title="Add" icon="add" onPress={() => router.push("/word/new")} /></Row>
      <Field label="Search dictionary" labelHidden placeholder="Search a word or translation" value={query} onChangeText={setQuery} autoCapitalize="none" />
      <View style={{ height: 1, backgroundColor: c.border }} />
      {!!task.error && <Notice error>{task.error}</Notice>}
    </View>}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.expression}`} onPress={() => router.push(`/word/${item.id}`)} style={{ minHeight: 54, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Body numberOfLines={2} style={{ flex: 1, fontFamily: "Fraunces_500Medium", fontSize: 18 }}>{item.expression}</Body><MaterialIcons name="chevron-right" size={22} color={c.mutedForeground} />
    </Pressable>}
    ListEmptyComponent={<Card><Heading small>{query ? "No matching words" : "Your first word starts here"}</Heading><Body muted>{query ? "Try another expression or its Russian translation." : "Add a word manually, or select an expression in an improved material."}</Body>
      {!query && <Button title="Add a word" secondary onPress={() => router.push("/word/new")} />}
    </Card>}
  />;
}
