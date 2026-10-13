import React, { useState } from "react";
import { Linking, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import * as ScreenCapture from "expo-screen-capture";
import { Body, Button, Card, Field, Heading, Label, Notice, Row, Screen, useTask } from "@/components/ui";
import { useApp } from "@/core/app-store";
import { keyStorage } from "@/core/key";
import { operations } from "@/core/operations";
import { connectKey } from "@/core/openrouter";
import { confirm } from "@/core/confirm";

export default function KeyConnectionScreen() {
  const { data, repo } = useApp();
  const task = useTask();
  const [key, setKey] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [protectedScreen, setProtectedScreen] = useState(false);
  useFocusEffect(React.useCallback(() => {
    let focused = true;
    setConnected(null);
    void keyStorage.has().then(value => { if (focused) setConnected(value); })
      .catch(() => { if (focused) task.setError("Protected storage could not be read."); });
    if (Platform.OS === "android") {
      void ScreenCapture.preventScreenCaptureAsync("api-key")
        .then(() => { if (focused) setProtectedScreen(true); })
        .catch(() => { if (focused) task.setError("Screen protection is unavailable. Key input is disabled."); });
    }
    return () => {
      focused = false;
      setKey(""); setProtectedScreen(false);
      if (operations.snapshot()?.label === "Checking OpenRouter key") operations.cancel();
      if (Platform.OS === "android") void ScreenCapture.allowScreenCaptureAsync("api-key");
    };
  }, []));
  return <Screen>
    <Label>OPENROUTER · NOT AN APP LOGIN</Label>
    <Heading>Connect your own key</Heading>
    <Body muted>A saved key is protected on your device and is never shown again.</Body>
    {Platform.OS !== "android" && <Notice>Connect keys in the Android app, not this browser preview. No unencrypted storage fallback is provided.</Notice>}
    <Card>
      <Row><Body style={{ fontFamily: "DMSans_700Bold" }}>Connection status</Body><Label>{connected === null ? "CHECKING" : connected ? "CONNECTED" : "NOT CONNECTED"}</Label></Row>
      <Field label={connected ? "Replacement API key · masked input" : "New key · masked input"} value={key} onChangeText={setKey}
        secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none"
        maxLength={256} editable={protectedScreen && !task.pending} placeholder="Paste your OpenRouter key" />
      <Body muted style={{ fontSize: 12 }}>Only paste when needed. A third-party keyboard or compromised device can still observe input.</Body>
      <Button title={task.pending ? "Working…" : connected ? "Verify & replace key" : "Verify & save key"}
        disabled={connected === null || !protectedScreen || !key.trim() || task.pending || !data.settings.consent}
        onPress={() => void task.run(async () => {
          operations.cancel();
          await operations.run("Checking OpenRouter key", undefined, signal => connectKey(key, signal));
          setKey(""); setConnected(await keyStorage.has());
        })} />
      {!data.settings.consent && <Body muted style={{ fontSize: 12 }}>Review and accept the data-transfer notice below before checking a key.</Body>}
      {connected && <Button title="Remove key from device" secondary destructive disabled={task.pending} onPress={() => void task.run(async () => {
        if (!await confirm("Remove saved key?", "This cancels active AI requests, but does not revoke the key at OpenRouter.")) return;
        operations.cancel(); await keyStorage.remove(); setConnected(false); setKey("");
      })} />}
    </Card>
    <Card>
      <Label>BEFORE THE FIRST REQUEST</Label>
      <Body>The selected audio/text is sent to OpenRouter and the provider of the chosen model. Provider retention varies; requests may cost money.</Body>
      {data.settings.consent ? <Body muted>Data-transfer notice accepted</Body> :
        <Button title="I understand" secondary onPress={() => void task.run(() => repo.update(d => { d.settings.consent = true; }))} />}
      <Body muted style={{ fontSize: 12 }}>A dedicated provider key with a spending limit is recommended. Cancellation may still be billed.</Body>
    </Card>
    {!!task.error && <Notice error>{task.error}</Notice>}
    <Body muted style={{ fontSize: 12 }}>If exposure is suspected, revoke the key in OpenRouter, check charges and create a new limited key.</Body>
    <Button title="Open provider account page" icon="arrow-forward" secondary onPress={() => void task.run(async () => {
      try { await Linking.openURL("https://openrouter.ai/settings/keys"); } catch { throw new Error("Could not open OpenRouter in your browser."); }
    })} />
  </Screen>;
}
