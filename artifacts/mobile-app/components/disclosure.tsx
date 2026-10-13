import React, { useState } from "react";
import { Collapsible, Host } from "@expo/ui";
import { useColors } from "../hooks/useColors";
export function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const c = useColors();
  return <Host matchContents={{ vertical: true }} colorScheme="light" seedColor={c.primary}><Collapsible label={label} labelStyle={{ color: c.primary }} isOpen={open} onOpenChange={setOpen}>{children}</Collapsible></Host>;
}
