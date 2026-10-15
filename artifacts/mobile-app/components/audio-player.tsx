import React, { useEffect } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router/react-navigation";
import { IconButton, Row } from "./ui";
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
  return <View>
    <Row style={{ gap: 6, justifyContent: "flex-start" }}>
      <IconButton name={status.playing ? "pause" : "play-arrow"} label={status.playing ? "Pause audio" : "Play audio"} onPress={() => {
        if (status.playing) player.pause();
        else { if (status.didJustFinish) void player.seekTo(0); player.play(); }
      }} />
      <Host style={{ flex: 1, minWidth: 0 }} matchContents={{ vertical: true }} colorScheme="light" seedColor={c.primary}>
        <Slider value={status.currentTime ?? 0} min={0} max={Math.max(1, status.duration ?? 0)} disabled={!status.isLoaded} onValueChange={value => { void player.seekTo(value); }} testID="audio-seek" />
      </Host>
    </Row>
  </View>;
}
