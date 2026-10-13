import React, { useState } from "react";
import { WebView } from "react-native-webview";
import { sentenceForSelection, transcriptDocument, type SelectableProps } from "../core/selection";
export function SelectableTranscript({ text, onSelect }: SelectableProps) {
  const [height, setHeight] = useState(140);
  return <WebView originWhitelist={["about:blank"]} source={{ html: transcriptDocument(text), baseUrl: "about:blank" }}
    style={{ height, backgroundColor: "transparent" }} scrollEnabled={false}
    javaScriptEnabled domStorageEnabled={false} allowFileAccess={false} allowUniversalAccessFromFileURLs={false}
    setSupportMultipleWindows={false} mixedContentMode="never"
    onShouldStartLoadWithRequest={r => r.url === "about:blank"}
    onMessage={event => {
      try {
        const value = JSON.parse(event.nativeEvent.data);
        if (value.type === "height" && Number.isFinite(value.height)) setHeight(Math.max(70, Math.min(24000, value.height + 12)));
        if (value.type === "selection") { const selected = sentenceForSelection(text, value.start, value.end); if (selected) onSelect(selected.expression, selected.sentence); }
      } catch { /* Only typed local messages are accepted; never evaluate returned content. */ }
    }}
  />;
}
