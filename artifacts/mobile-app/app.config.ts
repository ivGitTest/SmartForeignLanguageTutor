import type { ConfigContext, ExpoConfig } from "expo/config";
import app from "./constants/app-name.json";
// Expo transpiles this file, but does not transpile its local TypeScript dependencies.
const buildVersion = process.env.APP_VERSION;

if (buildVersion && !/^\d+\.\d+$/.test(buildVersion)) {
  throw new Error(`APP_VERSION must use the x.y format (for example, 1.2); received "${buildVersion}".`);
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: app.name,
  slug: config.slug ?? "smartlang",
  version: buildVersion ?? config.version ?? "1.0",
});
