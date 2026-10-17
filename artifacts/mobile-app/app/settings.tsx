import React, { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Host, Picker } from "@expo/ui";
import { Body, Button, Card, Heading, Label, Notice, Row, Screen, useTask } from "@/components/ui";
import { useApp } from "@/core/app-store";
import { appVersionLabel } from "@/core/app-version";
import { A_MODELS, B_MODELS, CEFR_PAIRS, cefrPairSchema, cefrPairLabel, defaults } from "@/core/model";
import { keyStorage } from "@/core/key";
import { operations } from "@/core/operations";
import { getCatalog, modelPrice, type Catalog } from "@/core/openrouter";
import { confirm } from "@/core/confirm";
import { useColors } from "@/hooks/useColors";
import * as Application from "expo-application";
import Constants, { ExecutionEnvironment } from "expo-constants";
import appInfo from "@/config/app_info.json";

export default function SettingsScreen() {
  const { data, repo, active } = useApp();
  const c = useColors();
  const task = useTask();
  const appVersion = appVersionLabel({
    isStoreClient: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
    expoConfigVersion: Constants.expoConfig?.version,
    nativeApplicationVersion: Application.nativeApplicationVersion,
    nativeBuildVersion: Application.nativeBuildVersion,
  });
  const [connected, setConnected] = useState<boolean | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  useFocusEffect(React.useCallback(() => {
    let focused = true;
    setConnected(null);
    void keyStorage.has().then(value => { if (focused) setConnected(value); })
      .catch(() => { if (focused) task.setError("Protected storage could not be read."); });
    return () => { focused = false; };
  }, []));
  useEffect(() => {
    const controller = new AbortController();
    void getCatalog(controller.signal).then(setCatalog).catch(() => { if (!controller.signal.aborted) setCatalogError("Catalog refresh failed. Built-in models remain visible; live availability and prices are unverified."); });
    return () => controller.abort();
  }, []);
  async function chooseModel(kind: "aModel" | "bModel", value: string, choices: readonly string[]) {
    if (!choices.includes(value)) return;
    const info = catalog?.models.find(m => m.id === value);
    if (kind === "bModel" && info) {
      const fixed = defaults();
      const params = [fixed.bParameters, fixed.translationParameters];
      const fields = ["temperature", "top_p", "max_tokens"];
      const incompatible = fields.filter(p => !info.supported_parameters.includes(p));
      if (incompatible.length) throw new Error(`This model does not support the fixed parameters: ${incompatible.join(", ")}. Choose another model.`);
    }
    await repo.update(d => {
      d.settings[kind] = value as never;
    });
  }
  function modelSection(label: string, kind: "aModel" | "bModel", choices: readonly string[]) {
    const info = catalog?.models.find(m => m.id === data.settings[kind]);
    return <Card>
      <Label>{label}</Label>
      <Body style={{ fontFamily: "DMSans_600SemiBold", fontSize: 13 }}>Selected {kind === "aModel" ? "A" : "B"} model</Body>
      <Host matchContents={{ vertical: true }} colorScheme="light" seedColor={c.primary}>
        <Picker selectedValue={data.settings[kind]} enabled={!task.pending} onValueChange={value => void task.run(() => chooseModel(kind, value, choices))}>
          {choices.map(value => <Picker.Item key={value} label={`${value.split("/")[1]}${catalog && !catalog.models.some(m => m.id === value) ? " · unavailable" : ""}`} value={value} />)}
        </Picker>
      </Host>
      <Body muted style={{ fontSize: 12 }}>{data.settings[kind]}</Body>
      {kind === "aModel" && <Body muted style={{ fontSize: 12 }}>Purpose: transcription</Body>}
      <Body muted style={{ fontSize: 12 }}>{info ? modelPrice(info, kind === "aModel") : catalog ? "This model is unavailable. Requests will be blocked; no automatic replacement." : "Rate unavailable · live availability not verified."}</Body>
      <Body muted style={{ fontSize: 12 }}>Last checked: {catalog ? new Date(catalog.at).toLocaleString() : "never"}</Body>
    </Card>;
  }
  return <Screen>
    <View style={{ gap: 5 }}>
      <Heading>Settings</Heading>
    </View>
    <View style={{ gap: 9 }}>
      <Body accessibilityRole="header" style={{ fontFamily: "DMSans_700Bold", fontSize: 17 }}>Privacy, in plain language</Body>
      <Card>
        <Body>Selected audio or text is sent to OpenRouter and the model provider. Their retention may vary. Only what the current step needs is sent.</Body>
        <Body muted style={{ fontSize: 12 }}>A dedicated provider key with a spending limit is recommended. No fixed budget is guaranteed.</Body>
        <Body muted style={{ fontSize: 12 }}>AI is billed to your OpenRouter account. Cancellation may still be billed. Learning stays offline.</Body>
        {data.settings.consent ? <Body>Data-transfer notice accepted</Body> : <Button title="I understand — enable AI requests" secondary onPress={() => void task.run(() => repo.update(d => { d.settings.consent = true; }))} />}
        <Body muted style={{ fontSize: 12 }}>All learning data is local and not cloud-backed up. Uninstalling the app removes it. Phone OS protection is used; there is no app login.</Body>
      </Card>
    </View>
    <Card>
      <Row>
        <Body style={{ fontFamily: "DMSans_700Bold", flexShrink: 1 }}>Provider connection</Body>
        <Body style={{ fontFamily: "DMSans_700Bold", fontSize: 10, backgroundColor: c.muted, color: c.primary, borderRadius: 30, paddingHorizontal: 10, paddingVertical: 4 }}>{connected === null ? "CHECKING" : connected ? "CONNECTED" : "NOT CONNECTED"}</Body>
      </Row>
      <Body muted style={{ fontSize: 12 }}>{connected === null ? "Checking protected key storage…" : connected ? "Key saved in Android protected storage. A saved key is never shown again." : "Connect your own OpenRouter key to use AI."}</Body>
      <Button title="Connect or manage key" secondary onPress={() => router.push("/key-connection")} />
    </Card>
    <View style={{ gap: 9 }}>
      <Body accessibilityRole="header" style={{ fontFamily: "DMSans_700Bold", fontSize: 17 }}>Models</Body>
      {modelSection("A · SPEECH TO TEXT", "aModel", A_MODELS)}
      {modelSection("B · IMPROVEMENT + TRANSLATION", "bModel", B_MODELS)}
      {!!catalogError && <Notice error>{catalogError}</Notice>}
      <Button title="Refresh availability & prices" secondary disabled={task.pending} onPress={() => void task.run(async () => {
        const result = await getCatalog(new AbortController().signal, true); setCatalog(result); setCatalogError("");
      })} />
    </View>
    <Card>
      <Label>Target</Label>
      <Host matchContents={{ vertical: true }} colorScheme="light" seedColor={c.primary}>
        <Picker testID="cefr-pair-picker" selectedValue={data.settings.cefrPair} enabled={!task.pending} onValueChange={value => void task.run(async () => {
          const pair = cefrPairSchema.parse(value);
          await repo.update(d => { d.settings.cefrPair = pair; });
        })}>
          {CEFR_PAIRS.map(pair => <Picker.Item key={pair} label={cefrPairLabel(pair)} value={pair} />)}
        </Picker>
      </Host>
      <Body muted style={{ fontSize: 12 }}>Current → target CEFR for improving B. A remains an English speech transcript.</Body>
    </Card>
    <View style={{ gap: 9 }}>
      <Body accessibilityRole="header" style={{ fontFamily: "DMSans_700Bold", fontSize: 17 }}>Fixed for this MVP</Body>
      <Card>
        {[["Interface", "English"], ["Learning", "English"], ["Native / translation", "Russian"], ["Session queue", "Up to 10 cards"], ["Theme", "Light"]].map(([label, value]) =>
          <Row key={label}><Body style={{ flexShrink: 1 }}>{label}</Body><Body style={{ fontFamily: "DMSans_700Bold", flexShrink: 1, textAlign: "right" }}>{value}</Body></Row>
        )}
      </Card>
    </View>
    <Button title="Restore defaults…" secondary disabled={task.pending} onPress={() => void task.run(async () => {
      if (!await confirm("Restore settings defaults?", "Target resets to B1 → B2. Models, parameters and prompts reset. The key, materials, Dictionary and learning progress stay unchanged. Data-transfer consent is also kept.")) return;
      await repo.update(d => { d.settings = { ...defaults(), consent: d.settings.consent }; });
    })} />
    {active && <Button title="Cancel active AI request" secondary onPress={() => operations.cancel()} />}
    {!!task.error && <Notice error>{task.error}</Notice>}
    <Card>
      <Heading small>About this app</Heading>
      <Row>
        <Body>Developer:</Body>
        <Body style={{ fontFamily: "DMSans_700Bold", flexShrink: 1, textAlign: "right" }}>{appInfo.developerName}</Body>
      </Row>
      <Row>
        <Body>Version:</Body>
        <Body style={{ fontFamily: "DMSans_700Bold", flexShrink: 1, textAlign: "right" }} testID="app-version">{appVersion}</Body>
      </Row>
      <Row>
        <Body>Support:</Body>
        <Pressable accessibilityRole="link" accessibilityLabel={appInfo.supportLabel} style={{ minHeight: 44, justifyContent: "center" }} onPress={() => void task.run(async () => {
          try { await Linking.openURL(appInfo.supportUrl); } catch { throw new Error(`Could not open the support link. Open ${appInfo.supportUrl.replace(/^https?:\/\//, "")} in your browser.`); }
        })}>
          <Body style={{ color: c.primary, fontFamily: "DMSans_700Bold" }}>{appInfo.supportLabel}</Body>
        </Pressable>
      </Row>
    </Card>
  </Screen>;
}
