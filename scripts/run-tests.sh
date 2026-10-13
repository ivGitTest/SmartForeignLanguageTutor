#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'HELP'
Run pytest UI tests on an Android emulator.

Required:
  SMART_LANG_TUTOR_APK=/path/to/app.apk
  ANDROID_SERIAL=emulator-5554

Optional:
  APPIUM_PORT=4723
  SMART_LANG_E2E_ALLOW_PHYSICAL_DEVICE=1  explicitly allow a physical device

The suite does not clear app data. It refuses to run if Dictionary or Materials
already contain data.
HELP
  exit 0
fi

if [[ -z "${SMART_LANG_TUTOR_APK:-}" || ! -f "${SMART_LANG_TUTOR_APK:-}" ]]; then
  echo "Set SMART_LANG_TUTOR_APK to the Android APK file." >&2
  echo 'Example: SMART_LANG_TUTOR_APK="/path/to/smart-lang-tutor.apk" ANDROID_SERIAL="emulator-5554" ./scripts/run-tests.sh' >&2
  exit 2
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install Python 3.10 or later." >&2
  exit 2
fi
if ! python3 -c 'import pytest, appium' >/dev/null 2>&1; then
  echo "Install the Python test packages first: python3 -m pip install -r tests/requirements.txt" >&2
  exit 2
fi
if ! command -v appium >/dev/null 2>&1; then
  echo "Install the Appium server first: npm install --global appium" >&2
  exit 2
fi
if ! command -v adb >/dev/null 2>&1; then
  echo "Android SDK Platform Tools (adb) are required and must be on PATH." >&2
  exit 2
fi

if [[ -z "${ANDROID_SERIAL:-}" ]]; then
  mapfile -t EMULATORS < <(adb devices | awk '$1 ~ /^emulator-/ && $2 == "device" { print $1 }')
  if [[ "${#EMULATORS[@]}" -ne 1 ]]; then
    echo "Set ANDROID_SERIAL to one running Android emulator from 'adb devices'." >&2
    exit 2
  fi
  export ANDROID_SERIAL="${EMULATORS[0]}"
fi

if ! adb -s "$ANDROID_SERIAL" get-state 2>/dev/null | grep -qx 'device'; then
  echo "Android target '$ANDROID_SERIAL' is not connected. Check 'adb devices'." >&2
  exit 2
fi

IS_EMULATOR="$(adb -s "$ANDROID_SERIAL" shell getprop ro.kernel.qemu | tr -d '\r')"
if [[ "$IS_EMULATOR" != "1" && "${SMART_LANG_E2E_ALLOW_PHYSICAL_DEVICE:-0}" != "1" ]]; then
  echo "Refusing to run on a physical device. Use a blank Android emulator, or explicitly set SMART_LANG_E2E_ALLOW_PHYSICAL_DEVICE=1." >&2
  exit 2
fi

if ! appium driver list --installed 2>&1 | grep -qi 'uiautomator2'; then
  echo "Installing Appium's Android UiAutomator2 driver..."
  appium driver install uiautomator2
fi

echo "Installing the APK as an update; existing app data is not cleared."
adb -s "$ANDROID_SERIAL" install -r "$SMART_LANG_TUTOR_APK"
adb -s "$ANDROID_SERIAL" shell pm grant com.englishlab.mobile android.permission.RECORD_AUDIO

export SMART_LANG_TUTOR_APK
export APPIUM_PORT="${APPIUM_PORT:-4723}"
if [[ "$#" -gt 0 ]]; then
  exec python3 -m pytest -q "$@"
fi
exec python3 -m pytest -q tests
