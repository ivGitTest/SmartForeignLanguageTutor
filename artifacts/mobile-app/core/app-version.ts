type AppVersionInput = {
  isStoreClient: boolean;
  expoConfigVersion?: string;
  nativeApplicationVersion?: string | null;
  nativeBuildVersion?: string | null;
};

export function appVersionLabel({
  isStoreClient,
  expoConfigVersion,
  nativeApplicationVersion,
  nativeBuildVersion,
}: AppVersionInput): string {
  // Expo Go's native version belongs to the host app, not to this project.
  const appVersion = isStoreClient
    ? expoConfigVersion
    : nativeApplicationVersion ?? expoConfigVersion;
  const buildVersion = isStoreClient ? null : nativeBuildVersion;

  if (!appVersion) return buildVersion ? `Build ${buildVersion}` : "Preview";
  return `${appVersion} · ${buildVersion ? `Build ${buildVersion}` : "Preview"}`;
}
