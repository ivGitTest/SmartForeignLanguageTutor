import React, { useEffect, useRef, useState } from "react";
import { sentenceForSelection, transcriptDocument, type SelectableProps } from "../core/selection";
/** A local sandboxed web-view equivalent for the browser preview, not a backend. */
export function SelectableTranscript({ text, onSelect }: SelectableProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(140);
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const value = event.data;
      if (value?.type === "height" && Number.isFinite(value.height)) setHeight(Math.max(70, Math.min(24000, value.height + 12)));
      if (value?.type === "selection") { const selected = sentenceForSelection(text, value.start, value.end); if (selected) onSelect(selected.expression, selected.sentence); }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [text, onSelect]);
  return <iframe ref={frame} title="B · select a word or phrase" sandbox="allow-scripts" srcDoc={transcriptDocument(text)} style={{ width: "100%", height, border: 0, background: "transparent" }} />;
}
