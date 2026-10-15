/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Run the actual component with a deterministic native-hook double. Expo's
// release happens before later effect cleanups; a pause in focus cleanup must fail.
function mountPlayer(focused = true) {
  const effects: (() => void | (() => void))[] = [];
  const listeners = new Set<(state: string) => void>();
  let released = false;
  let pauses = 0;
  const player = {
    pause() {
      if (released) throw new Error("Native shared object was already released");
      pauses++;
    },
  };
  const react = {
    createElement: () => null,
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => void | (() => void)) => effects.push(effect),
  };
  const source = fs.readFileSync(new URL("../components/audio-player.tsx", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const modules: Record<string, unknown> = {
    react,
    "expo-audio": {
      useAudioPlayer: () => {
        effects.push(() => () => { released = true; });
        return player;
      },
      useAudioPlayerStatus: () => ({ playing: false }),
    },
    "expo-router": {
      useFocusEffect: (effect: () => void | (() => void)) => effects.push(effect),
    },
    "expo-router/react-navigation": { useIsFocused: () => focused },
    "react-native": {
      Pressable: () => null,
      View: () => null,
      AppState: {
        addEventListener: (_event: string, listener: (state: string) => void) => {
          listeners.add(listener);
          return { remove: () => listeners.delete(listener) };
        },
      },
    },
    "@expo/vector-icons": { MaterialIcons: () => null },
    "./ui": { Row: () => null },
    "@expo/ui": { Host: () => null, Slider: () => null },
    "../hooks/useColors": { useColors: () => ({ primary: "#000" }) },
  };
  const exports: { AudioPlayer?: (props: { uri: string }) => unknown } = {};
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => {
      assert.ok(name in modules, `Unexpected dependency ${name}`);
      return modules[name];
    },
  });
  exports.AudioPlayer!({ uri: "file:///test-recording.m4a" });
  const cleanups = effects.map(effect => effect());
  return {
    get pauses() { return pauses; },
    background() { listeners.forEach(listener => listener("background")); },
    unmount() { cleanups.forEach(cleanup => { if (typeof cleanup === "function") cleanup(); }); },
    get listeners() { return listeners.size; },
  };
}

test("material Back never pauses an already released native audio player", () => {
  const component = mountPlayer();
  assert.equal(component.pauses, 0);
  assert.doesNotThrow(() => component.unmount());
  assert.equal(component.listeners, 0);
  assert.doesNotThrow(() => component.background());
});

test("a still mounted material pauses audio on blur and background", () => {
  const component = mountPlayer(false);
  assert.equal(component.pauses, 1);
  component.background();
  assert.equal(component.pauses, 2);
  assert.doesNotThrow(() => component.unmount());
});
