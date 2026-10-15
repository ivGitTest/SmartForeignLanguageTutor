import { Body, Card, Heading, Notice } from "./ui";
export function Recorder({ disabled: _disabled, visible = true }: { disabled: boolean; visible?: boolean }) {
  if (!visible) return null;
  return <Card><Heading small>Speak naturally.</Heading><Body muted>Up to 2 minutes</Body><Notice>Microphone recording is native Android functionality. Install the APK or open this project in Expo Go to record. Browser preview does not create simulated audio.</Notice></Card>;
}
