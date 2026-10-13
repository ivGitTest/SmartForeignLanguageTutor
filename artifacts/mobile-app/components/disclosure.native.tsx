import React, { useState } from "react";
import { View } from "react-native";
import { Collapsible, Host } from "@expo/ui";
import { RNHostView } from "@expo/ui/jetpack-compose";
import { useColors } from "../hooks/useColors";
/** Android is the only native MVP target. RN form content is explicitly bridged into Compose. */
export function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const c = useColors();
  return <Host matchContents={{ vertical: true }} colorScheme="light" seedColor={c.primary}>
    <Collapsible label={label} labelStyle={{ color: c.primary }} isOpen={open} onOpenChange={setOpen}>
      <RNHostView matchContents={{ vertical: true }}><View style={{ gap: 12 }}>{children}</View></RNHostView>
    </Collapsible>
  </Host>;
}
