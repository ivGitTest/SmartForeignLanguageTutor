import React, { useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Host, Picker } from "@expo/ui";
import * as ScreenCapture from "expo-screen-capture";
import { Body, Button, Card, Field, Heading, Label, Notice, Screen, useTask } from "@/components/ui";
import { useApp } from "@/core/app-store";
import { A_MODELS, B_MODELS, defaults } from "@/core/model";
import { keyStorage } from "@/core/key";
import { operations } from "@/core/operations";
import { connectKey, getCatalog, modelPrice, type Catalog } from "@/core/openrouter";
import { confirm } from "@/core/confirm";
import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const { data, repo, active } = useApp();
  const c = useColors();
  const task = useTask();
  const [key, setKey] = useState("");
  const [connected, setConnected] = useState(false);
  const [protectedScreen, setProtectedScreen] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  useFocusEffect(React.useCallback(() => {
    void keyStorage.has().then(setConnected).catch(() => task.setError("Protected storage could not be read."));
    if (Platform.OS === "android") void ScreenCapture.preventScreenCaptureAsync("api-key").then(() => setProtectedScreen(true)).catch(() => task.setError("Screen protection is unavailable. Key input is disabled."));
    return () => {
      setKey(""); setProtectedScreen(false);
      if (operations.snapshot()?.label === "Checking OpenRouter key") operations.cancel();
      if (Platform.OS === "android") void ScreenCapture.allowScreenCaptureAsync("api-key");
    };
  }, []));
  useEffect(() => {
    const controller = new AbortController();
    void getCatalog(controller.signal).then(setCatalog).catch(() => { if (!controller.signal.aborted) setCatalogError("Catalog refresh failed. Built-in models remain visible; live availability and prices are unverified."); });
    return () => controller.abort();
  }, []);
  async function chooseModel(kind: "aModel" | "bModel", value: string, choices: readonly string[]) {
    if (!choices.includes(value)) return;
    const info = catalog?.models.find(m => m.id === value);
    let reset = false;
    if (kind === "bModel" && info) {
      const params = [data.settings.bParameters, data.settings.translationParameters];
      const fields = ["temperature", "top_p", "max_tokens", ...(params.some(p => p.seed !== undefined) ? ["seed"] : [])];
      const incompatible = fields.filter(p => !info.supported_parameters.includes(p));
      if (incompatible.some(p => p !== "seed")) throw new Error(`This model cannot support the required parameters: ${incompatible.join(", ")}. Choose another model.`);
      if (incompatible.length) {
        if (!await confirm("Incompatible parameters", "This model does not support your seed. Restore the default B and translation parameters before switching? Your prompts will be preserved.")) return;
        reset = true;
      }
    }
    await repo.update(d => {
      d.settings[kind] = value as never;
      if (reset) { d.settings.bParameters = defaults().bParameters; d.settings.translationParameters = defaults().translationParameters; }
    });
  }
  function modelSection(label: string, kind: "aModel" | "bModel", choices: readonly string[]) {
    const info = catalog?.models.find(m => m.id === data.settings[kind]);
    return <Card>
      <Heading small>{label}</Heading>
      <Host matchContents={{ vertical: true }} colorScheme="light" seedColor={c.primary}>
        <Picker selectedValue={data.settings[kind]} enabled={!task.pending} onValueChange={value => void task.run(() => chooseModel(kind, value, choices))}>
          {choices.map(value => <Picker.Item key={value} label={`${value.split("/")[1]}${catalog && !catalog.models.some(m => m.id === value) ? " · unavailable" : ""}`} value={value} />)}
        </Picker>
      </Host>
      <Body muted style={{ fontSize: 12 }}>{data.settings[kind]}</Body>
      <Body muted style={{ fontSize: 12 }}>{info ? modelPrice(info, kind === "aModel") : catalog ? "This model is unavailable. Requests will be blocked; no automatic replacement." : "Live availability and pricing not verified."}</Body>
      <Body muted style={{ fontSize: 12 }}>Quality and Android audio compatibility still require real-device qualification.</Body>
    </Card>;
  }
  return <Screen>
    <Label>MAKE IT WORK FOR YOU</Label><Heading>Settings</Heading>
    <Card>
      <Heading small>OpenRouter connection</Heading>
      <Body>{connected ? "Key saved in Android protected storage" : "No key connected"}</Body>
      <Body muted style={{ fontSize: 12 }}>Use your own key with a spending limit. AI is billed to your OpenRouter account. A saved key is never shown again.</Body>
      <Button title="Open OpenRouter key settings" secondary onPress={() => void task.run(async () => { try { await Linking.openURL("https://openrouter.ai/settings/keys"); } catch { throw new Error("Could not open OpenRouter in your browser."); } })} />
      {Platform.OS !== "android" && <Notice>Connect keys in the Android app, not this browser preview. No unencrypted storage fallback is provided.</Notice>}
      <Field label={connected ? "Replacement API key" : "API key"} value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" maxLength={256} editable={protectedScreen && !task.pending} placeholder="Paste your OpenRouter key" />
      <Body muted style={{ fontSize: 12 }}>Only paste when needed. A third-party keyboard or compromised device can still observe input.</Body>
      <Button title={task.pending ? "Working…" : connected ? "Verify & replace key" : "Verify & save key"} disabled={!protectedScreen || !key.trim() || task.pending} onPress={() => void task.run(async () => {
        operations.cancel();
        await operations.run("Checking OpenRouter key", undefined, (signal) => connectKey(key, signal));
        setKey(""); setConnected(await keyStorage.has());
      })} />
      {connected && <Button title="Remove key from device" secondary destructive disabled={task.pending} onPress={() => void task.run(async () => {
        if (!await confirm("Remove saved key?", "This cancels active AI requests, but does not revoke the key at OpenRouter.")) return;
        operations.cancel(); await keyStorage.remove(); setConnected(false); setKey("");
      })} />}
      <Body muted style={{ fontSize: 12 }}>If exposure is suspected, revoke the key in OpenRouter, check charges and create a new limited key.</Body>
    </Card>
    <Card><Heading small>Data & AI costs</Heading><Body muted>Transcription sends your chosen audio to OpenRouter and the model provider. Other actions send only their source text or selected sentence. Provider retention depends on its policies; zero retention is not promised. Cancellation may still be billed. Learning stays offline.</Body>
      {data.settings.consent ? <Body>Data-transfer notice accepted</Body> : <Button title="I understand — enable AI requests" secondary onPress={() => void task.run(() => repo.update(d => { d.settings.consent = true; }))} />}
      <Body muted style={{ fontSize: 12 }}>All learning data is local and not cloud-backed up. Uninstalling the app removes it. Phone OS protection is used; there is no app login.</Body>
    </Card>
    {modelSection("B · Improve & translate", "bModel", B_MODELS)}
    {modelSection("A · Speech recognition", "aModel", A_MODELS)}
    {catalog && <Body muted style={{ fontSize: 12 }}>Catalog checked {new Date(catalog.at).toLocaleString()}. Provider routing can affect actual charges.</Body>}
    {!!catalogError && <Notice error>{catalogError}</Notice>}
    <Button title="Refresh availability & prices" secondary disabled={task.pending} onPress={() => void task.run(async () => {
      const result = await getCatalog(new AbortController().signal, true); setCatalog(result); setCatalogError("");
    })} />
    <Button title="AI instructions & parameters" icon="tune" secondary onPress={() => router.push("/ai-settings")} />
    <Card><Heading small>Languages & appearance</Heading><Body>Interface · English{"\n"}Native language · Russian{"\n"}Learning · English{"\n"}Improvement · B1 → B2{"\n"}Theme · Light</Body><Body muted style={{ fontSize: 12 }}>Other languages, levels and themes are outside this MVP.</Body></Card>
    <Button title="Reset settings to defaults" secondary disabled={task.pending} onPress={() => void task.run(async () => {
      if (!await confirm("Reset settings?", "Restore models, parameters and prompts. Keep your key, data-transfer consent, materials, dictionary and learning progress.")) return;
      await repo.update(d => { d.settings = { ...defaults(), consent: d.settings.consent }; });
    })} />
    {active && <Button title="Cancel active AI request" secondary onPress={() => operations.cancel()} />}
    {!!task.error && <Notice error>{task.error}</Notice>}
    <Card><Heading small>About</Heading><Body>Developer · Рыбаков Иван</Body><Button title="@ivTelegram" secondary onPress={() => void task.run(async () => {
      try { await Linking.openURL("https://t.me/ivTelegram"); } catch { throw new Error("Could not open Telegram. Open t.me/ivTelegram in your browser."); }
    })} /></Card>
  </Screen>;
}
