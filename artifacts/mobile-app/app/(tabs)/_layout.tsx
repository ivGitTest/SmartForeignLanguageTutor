import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { Brand, SettingsButton } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
export default function TabsLayout() {
  const c = useColors();
  return <Tabs initialRouteName="index" screenOptions={{
    headerTitle: () => <Brand />, headerTitleAlign: "left", headerRight: () => <SettingsButton />,
    headerStyle: { backgroundColor: c.background, ...(Platform.OS === "web" ? { height: 94 } : {}) },
    headerShadowVisible: false, sceneStyle: { backgroundColor: c.background },
    tabBarActiveTintColor: c.primary, tabBarInactiveTintColor: c.mutedForeground,
    tabBarStyle: { backgroundColor: c.background, borderTopColor: c.border, ...(Platform.OS === "web" ? { height: 84, paddingBottom: 24 } : {}) },
    tabBarLabelStyle: { fontFamily: "DMSans_600SemiBold", fontSize: 11 },
  }}>
    <Tabs.Screen name="index" options={{ title: "Dictionary", tabBarIcon: ({ color, size }) => <MaterialIcons name="menu-book" color={color} size={size} /> }} />
    <Tabs.Screen name="materials" options={{ title: "Materials", tabBarIcon: ({ color, size }) => <MaterialIcons name="mic-none" color={color} size={size} /> }} />
    <Tabs.Screen name="learning" options={{ title: "Learning", tabBarIcon: ({ color, size }) => <MaterialIcons name="school" color={color} size={size} /> }} />
  </Tabs>;
}
