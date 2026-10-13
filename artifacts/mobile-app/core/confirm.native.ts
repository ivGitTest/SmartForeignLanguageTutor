import { Alert } from "react-native";
export function confirm(title: string, message: string): Promise<boolean> {
  return new Promise(resolve => Alert.alert(title, message, [
    { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
    { text: "Confirm", style: "destructive", onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}
