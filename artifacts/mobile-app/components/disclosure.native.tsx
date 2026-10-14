import React, { useState } from "react";
import { View } from "react-native";
import { Collapsible, Host } from "@expo/ui";
import { RNHostView } from "@expo/ui/jetpack-compose";
import { onSizeChanged } from "@expo/ui/jetpack-compose/modifiers";
import { useColors } from "../hooks/useColors";
/** Android is the only native MVP target. RN form content is explicitly bridged into Compose. */
export function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [contentWidth, setContentWidth] = useState<number>();
  const c = useColors();
  return <Host style={{ width: "100%", minWidth: 0 }} matchContents={{ vertical: true }} colorScheme="light" seedColor={c.primary}>
    <Collapsible label={label} labelStyle={{ color: c.primary }} isOpen={open} onOpenChange={setOpen}>
      <RNHostView matchContents={{ vertical: true }} modifiers={[onSizeChanged(({ width }) => {
        if (width > 0) setContentWidth(width);
      })]}>
        {/* Yoga percentages otherwise resolve against the outer Host, ignoring Compose's padding.
            Use the inner Compose measurement (dp), including updates after window resizing. */}
        <View style={{ gap: 12, width: contentWidth ?? 0, minWidth: 0 }}>
          {contentWidth !== undefined ? children : null}
        </View>
      </RNHostView>
    </Collapsible>
  </Host>;
}
