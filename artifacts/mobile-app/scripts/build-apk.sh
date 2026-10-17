#!/usr/bin/env bash
set -euo pipefail

# pnpm may forward its `--` argument separator to the underlying script.
if [[ "${1:-}" == "--" ]]; then
  shift
fi

VERSION="${1:-}"
BUILD_PROFILE="${BUILD_PROFILE:-preview}"

if [[ $# -ne 1 || ! "$VERSION" =~ ^[0-9]+\.[0-9]+$ ]]; then
  echo "Provide the app version as x.y (for example, 1.2)." >&2
  echo "Usage: pnpm --filter @workspace/mobile-app run build:apk -- <version>" >&2
  echo "       pnpm --filter @workspace/mobile-app run build:apk:production -- <version>" >&2
  exit 2
fi

if [[ "$BUILD_PROFILE" != "preview" && "$BUILD_PROFILE" != "production" ]]; then
  echo "Unsupported Android build profile: $BUILD_PROFILE (expected preview or production)." >&2
  exit 2
fi

export APP_VERSION="$VERSION"

EXPECTED_SLUG="smartlang"
EXPECTED_OWNER="ivaexpi"
EXPECTED_PROJECT_ID="24594e06-57d4-416b-9f3e-5f212b9c2cd5"
EAS_CLI_VERSION="24.13.0"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

echo "Checking Expo project configuration..."
PUBLIC_CONFIG="$(pnpm exec expo config --type public --json)"
printf '%s\n' "$PUBLIC_CONFIG" | EXPECTED_SLUG="$EXPECTED_SLUG" EXPECTED_OWNER="$EXPECTED_OWNER" EXPECTED_PROJECT_ID="$EXPECTED_PROJECT_ID" EXPECTED_VERSION="$APP_VERSION" node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  try {
    const config = JSON.parse(input);
    const expected = {
      slug: process.env.EXPECTED_SLUG,
      owner: process.env.EXPECTED_OWNER,
      projectId: process.env.EXPECTED_PROJECT_ID,
      version: process.env.EXPECTED_VERSION,
    };
    const actual = {
      slug: config.slug,
      owner: config.owner,
      projectId: config.extra?.eas?.projectId,
      version: config.version,
    };
    if (Object.keys(expected).some(key => expected[key] !== actual[key])) {
      console.error("Expo project mismatch.");
      console.error("Expected:", JSON.stringify(expected));
      console.error("Actual:", JSON.stringify(actual));
      process.exitCode = 1;
      return;
    }
    console.log(`Project verified: ${actual.owner}/${actual.slug}`);
  } catch (error) {
    console.error("Could not parse Expo public config:", error.message);
    process.exitCode = 1;
  }
});
'

if [[ -n "${EXPO_TOKEN:-}" ]]; then
  echo "Checking Expo access token (expected account: $EXPECTED_OWNER)..."
else
  echo "Checking saved Expo login (expected account: $EXPECTED_OWNER)..."
fi

if ! WHOAMI_OUTPUT="$(pnpm dlx "eas-cli@$EAS_CLI_VERSION" whoami 2>&1)"; then
  printf '%s\n' "$WHOAMI_OUTPUT" >&2
  if [[ -n "${EXPO_TOKEN:-}" ]]; then
    echo "Expo rejected EXPO_TOKEN. Replace it in Replit Secrets with a valid token for $EXPECTED_OWNER." >&2
  else
    echo "Expo CLI has no saved login. Run pnpm run eas:login once, or add EXPO_TOKEN to Replit Secrets." >&2
  fi
  exit 1
fi

if ! grep -Eq "(^|[^[:alnum:]_-])@?${EXPECTED_OWNER}($|[^[:alnum:]_-])" <<< "$WHOAMI_OUTPUT"; then
  echo "Logged-in Expo account does not match: expected $EXPECTED_OWNER." >&2
  printf '%s\n' "$WHOAMI_OUTPUT" >&2
  echo "Log in to the correct account with: pnpm run eas:login" >&2
  exit 1
fi

echo "Starting Android $BUILD_PROFILE APK build on EAS with app version $APP_VERSION..."
exec pnpm dlx "eas-cli@$EAS_CLI_VERSION" build --platform android --profile "$BUILD_PROFILE"
