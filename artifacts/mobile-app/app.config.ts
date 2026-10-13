import type { ConfigContext, ExpoConfig } from "expo/config";
import app from "./constants/app-name.json";
// Expo transpiles this file, but does not transpile its local TypeScript dependencies.
export default ({ config }: ConfigContext): ExpoConfig => ({ ...config, name: app.name, slug: config.slug ?? "mobile-app" });
