import React, { useEffect } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router/react-navigation";
import { Body, Button, Row } from "./ui";
import { Host, Slider } from "@expo/ui";
import { View } from "react-native";
import { useColors } from "../hooks/useColors";
export function AudioPlayer({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const c = useColors();
  const focused = useIsFocused();
  // useAudioPlayer releases its native object on unmount. Never call pause from
  // a cleanup: the player may already be released when focus cleanup runs.
  useEffect(() => { if (!focused) player.pause(); }, [focused, player]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => { if (state !== "active") player.pause(); });
    return () => listener.remove();
  }, [player]);
  return <View style={{ gap: 8 }}><Row>
    <Button title={status.playing ? "Pause audio" : "Play audio"} icon={status.playing ? "pause" : "play-arrow"} secondary onPress={() => {
      if (status.playing) player.pause();
      else { if (status.didJustFinish) void player.seekTo(0); player.play(); }
    }} />
    <Body muted>{Math.floor(status.currentTime ?? 0)} / {Math.floor(status.duration ?? 0)}s</Body>
  </Row><Host matchContents={{ vertical: true }} colorScheme="light" seedColor={c.primary}>
    <Slider value={status.currentTime ?? 0} min={0} max={Math.max(1, status.duration ?? 0)} disabled={!status.isLoaded} onValueChange={value => { void player.seekTo(value); }} testID="audio-seek" />
  </Host></View>;
}
