import React, { useEffect } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { AppState, Pressable, View } from "react-native";
import { useIsFocused } from "expo-router/react-navigation";
import { MaterialIcons } from "@expo/vector-icons";
import { Row } from "./ui";
import { Host, Slider } from "@expo/ui";
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
    <Row style={{ gap: 10, justifyContent: "flex-start", alignItems: "center" }}>
      <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? "Pause audio" : "Play audio"}
        onPress={() => {
        if (status.playing) player.pause();
        else { if (status.didJustFinish) void player.seekTo(0); player.play(); }
      }}
        style={({ pressed }) => ({
          width: 48, height: 48, borderRadius: 24, backgroundColor: c.secondary,
          alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1,
        })}>
        <MaterialIcons name={status.playing ? "pause" : "play-arrow"} size={24} color={c.primary} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0, height: 48, justifyContent: "center" }}>
        <Host style={{ width: "100%", minWidth: 0 }} matchContents={{ vertical: true }} colorScheme="light" seedColor={c.primary}>
          <Slider value={status.currentTime ?? 0} min={0} max={Math.max(1, status.duration ?? 0)} disabled={!status.isLoaded} onValueChange={value => { void player.seekTo(value); }} testID="audio-seek" />
        </Host>
      </View>
    </Row>
  </View>;
}
