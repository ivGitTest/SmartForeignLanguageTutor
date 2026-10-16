import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Body } from "./ui";
import { useColors } from "../hooks/useColors";

/** Keep expandable content in the React Native tree on web and Android. */
export function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const c = useColors();

  return (
    <View style={{ width: "100%", minWidth: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(value => !value)}
        style={({ pressed }) => ({
          width: "100%",
          minWidth: 0,
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Body style={{ color: c.primary, fontFamily: "DMSans_600SemiBold", flex: 1, flexShrink: 1, minWidth: 0 }}>
          {label}
        </Body>
        <MaterialIcons name={open ? "expand-less" : "expand-more"} size={22} color={c.primary} />
      </Pressable>
      {open && (
        <View style={{ width: "100%", minWidth: 0, alignSelf: "stretch", gap: 12, paddingTop: 8 }}>
          {children}
        </View>
      )}
    </View>
  );
}
