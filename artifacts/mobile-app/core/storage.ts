// Browser preview stores non-secret learning data only; it is not the Android storage implementation.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Persistence } from "./repository";
export const persistence: Persistence = {
  read: () => AsyncStorage.getItem("smart-lang-tutor-preview-v1"),
  write: value => AsyncStorage.setItem("smart-lang-tutor-preview-v1", value),
};
