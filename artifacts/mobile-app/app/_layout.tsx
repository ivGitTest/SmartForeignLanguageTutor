import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider } from '@/core/app-store';
import { useColors } from '@/hooks/useColors';
import { AppState, View } from 'react-native';
import { stopSpeaking } from '@/core/speech';
import { Body } from '@/components/ui';
import { APP_NAME } from '@/constants/app';
import { StatusBar } from 'expo-status-bar';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const c = useColors();
  const [backgrounded, setBackgrounded] = React.useState(false);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      setBackgrounded(state !== "active");
      if (state !== "active") stopSpeaking();
    });
    return () => subscription.remove();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerBackTitle: 'Back', headerStyle: { backgroundColor: c.background }, headerTintColor: c.primary, headerShadowVisible: false, contentStyle: { backgroundColor: c.background } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="word/[id]" options={{ title: "Word card" }} />
      <Stack.Screen name="material/[id]" options={{ title: "Material" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="key-connection" options={{ title: "Provider key" }} />
      <Stack.Screen name="ai-settings" options={{ title: "AI settings" }} />
    </Stack>
    {backgrounded && <View style={{ position: "absolute", inset: 0, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }}><Body>{APP_NAME}</Body></View>}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Fraunces_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <AppProvider><RootLayoutNav /></AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
