import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import type { RefObject } from "react";
import { confirm } from "./confirm";
export function useUnsavedChanges(dirty: boolean, saved?: RefObject<boolean>) {
  const navigation = useNavigation();
  usePreventRemove(dirty, ({ data }) => {
    if (saved?.current) { navigation.dispatch(data.action); return; }
    void confirm("Unsaved changes", "Leave this screen without saving these edits?").then(leave => { if (leave) navigation.dispatch(data.action); });
  });
}
