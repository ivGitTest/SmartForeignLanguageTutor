# Android UI tests

The pytest suite drives the installed Android app through Appium. It covers Dictionary, Materials, Learning, navigation, local storage, and native audio recording. Speech recognition, improvement, translation, and model execution are never started. Opening Settings can read the public model catalog; the tests do not enter or transmit a user key.

## Requirements

- Python 3.10 or later and packages from `tests/requirements.txt`
- Node.js and Appium Server on `PATH`, with the UiAutomator2 driver installed
- Android SDK Platform Tools (`adb`) and an Android 14+ emulator (API 33+)
- An APK built by the normal EAS preview workflow

One-time setup:

```bash
python3 -m pip install -r tests/requirements.txt
npm install --global appium
appium driver install uiautomator2
```

Start a blank Android emulator, then run from the repository root:

```bash
SMART_LANG_TUTOR_APK="/path/to/smart-lang-tutor.apk" \
ANDROID_SERIAL="emulator-5554" \
bash scripts/run-tests.sh
```

`ANDROID_SERIAL` is the device ID shown by `adb devices`. The script installs the APK as an update (`adb install -r`) and grants microphone permission for the recording test. It never clears application data or uninstalls the app. Use a clean test installation with an empty Dictionary and Materials list: pytest checks both screens first and refuses to modify an app that already contains user data.

The recording test uses the emulator microphone, creates short local recordings, and deletes them. If a test fails partway through, some test-labelled records may remain; review the emulator before rerunning. Never point the suite at an app with personal data. A physical device is rejected by default; to opt in deliberately, set `SMART_LANG_E2E_ALLOW_PHYSICAL_DEVICE=1` after confirming the Dictionary and Materials are empty. That device's microphone permission and the app's first-use microphone notice may change.

Test phrases and Russian meanings are in `tests/fixtures/sample-data.json`. Words are created through the app's own forms and removed when the session fixture ends. Materials are created by recording through the native UI, not seeded through a test-only app backdoor. Since A cannot be entered until transcription, the tests leave A/B/translation empty rather than calling an AI provider.

To run only one functional group, keep the APK and emulator variables and pass a file:

```bash
SMART_LANG_TUTOR_APK="/path/to/smart-lang-tutor.apk" \
ANDROID_SERIAL="emulator-5554" \
bash scripts/run-tests.sh tests/test_dictionary.py
```
