import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View, type TextInputProps, type TextProps, type ViewStyle } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { KeyboardAwareScrollViewCompat } from "./KeyboardAwareScrollViewCompat";
import { useColors } from "../hooks/useColors";
import { APP_NAME } from "../constants/app";

export type ButtonTone = "again" | "hard" | "good" | "easy";
const buttonTones: Record<ButtonTone, { background: string; foreground: string }> = {
  again: { background: "#a33b36", foreground: "#fffefa" },
  hard: { background: "#985117", foreground: "#fffefa" },
  good: { background: "#315f91", foreground: "#fffefa" },
  easy: { background: "#367044", foreground: "#fffefa" },
};

export function Body({ style, muted, ...props }: TextProps & { muted?: boolean }) {
  const c = useColors();
  return <Text {...props} style={[{ fontFamily: "DMSans_400Regular", fontSize: 15, lineHeight: 23, color: muted ? c.mutedForeground : c.foreground }, style]} />;
}
export function Heading({ children, small = false, accessibilityLabel }: { children: React.ReactNode; small?: boolean; accessibilityLabel?: string }) {
  const c = useColors();
  return <Text accessibilityRole="header" accessibilityLabel={accessibilityLabel} style={{ fontFamily: "Fraunces_500Medium", fontSize: small ? 23 : 33, lineHeight: small ? 30 : 40, color: c.foreground }}>{children}</Text>;
}
export function Label({ children }: { children: React.ReactNode }) {
  return <Body muted style={{ fontFamily: "DMSans_700Bold", fontSize: 11, letterSpacing: 1.2 }}>{children}</Body>;
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[{ padding: 17, gap: 12, borderRadius: c.radius, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }, style]}>{children}</View>;
}
export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "space-between" }, style]}>{children}</View>;
}
export function Button({ title, onPress, disabled, secondary, destructive, icon, tone }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; destructive?: boolean; icon?: React.ComponentProps<typeof MaterialIcons>["name"]; tone?: ButtonTone;
}) {
  const c = useColors();
  const toneColors = tone ? buttonTones[tone] : undefined;
  const foreground = toneColors?.foreground ?? (secondary ? destructive ? c.destructive : c.primary : c.primaryForeground);
  const background = toneColors?.background ?? (secondary ? c.secondary : destructive ? c.destructive : c.primary);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 50, paddingHorizontal: 17, paddingVertical: 12, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, backgroundColor: background })}>
    {icon && <MaterialIcons name={icon} size={20} color={foreground} />}
    <Body style={{ fontFamily: "DMSans_700Bold", color: foreground, textAlign: "center" }}>{title}</Body>
  </Pressable>;
}
export function IconButton({ name, label, onPress, disabled }: { name: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; onPress: () => void; disabled?: boolean }) {
  const c = useColors();
  return <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}>
    <MaterialIcons name={name} size={24} color={c.primary} />
  </Pressable>;
}
export function Field({ label, style, containerStyle, labelHidden = false, ...props }: TextInputProps & { label: string; containerStyle?: ViewStyle; labelHidden?: boolean }) {
  const c = useColors();
  return <View style={[{ gap: 7 }, containerStyle]}>
    {!labelHidden && <Body style={{ fontFamily: "DMSans_600SemiBold", fontSize: 13 }}>{label}</Body>}
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor={c.mutedForeground}
      style={[{ fontFamily: "DMSans_400Regular", fontSize: 16, color: c.foreground, padding: 13, minHeight: 49, borderWidth: 1, borderColor: c.border, borderRadius: 14, backgroundColor: c.card, textAlignVertical: props.multiline ? "top" : "center" }, style]} />
  </View>;
}
export function Screen({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <KeyboardAwareScrollViewCompat contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 18, width: "100%", maxWidth: 640, alignSelf: "center" }} keyboardShouldPersistTaps="handled">
    {children}
  </KeyboardAwareScrollViewCompat>;
}
export function Brand() {
  const c = useColors();
  return <Row style={{ justifyContent: "flex-start" }}>
    <View style={{ backgroundColor: c.primary, width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" }}><Body style={{ fontFamily: "Fraunces_500Medium", fontSize: 22, color: c.card }}>S</Body></View>
    <Body style={{ fontFamily: "DMSans_700Bold", fontSize: 15 }}>{APP_NAME}</Body>
  </Row>;
}
export function SettingsButton() { return <IconButton name="settings" label="Settings" onPress={() => router.push("/settings")} />; }
export function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  const c = useColors();
  return <View accessibilityLiveRegion={error ? "assertive" : "polite"} style={{ backgroundColor: error ? c.accent : c.muted, padding: 14, borderRadius: 15 }}>
    <Body selectable style={{ fontSize: 13, lineHeight: 20, color: error ? c.destructive : c.mutedForeground }}>{children}</Body>
  </View>;
}
export function useTask() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  async function run(task: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setError(""); setPending(true);
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "Could not complete this action. Try again."); }
    finally { lock.current = false; setPending(false); }
  }
  return { error, setError, pending, run };
}
export function Busy({ label }: { label: string }) {
  return <Row style={{ justifyContent: "flex-start" }}><ActivityIndicator /><Body muted>{label}</Body></Row>;
}
