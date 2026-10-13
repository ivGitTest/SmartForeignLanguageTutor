# Android UI tests

The pytest suite drives the installed Android app through Appium. It covers Dictionary, Materials, Learning, navigation, local storage, and native audio recording. Speech recognition, improvement, translation, and model execution are never started. Opening Settings can read the public model catalog; the tests do not enter or transmit a user key.

There are two layers:

| Group | Android UI checks | Offline checks using the real application domain |
| --- | --- | --- |
| Dictionary | Required fields, duplicate detection, create/edit/search/delete, add-card route | Selection context, normalized expressions, populated dictionary and durable storage |
| Materials | Record/stop/discard/save, title, search, newest-first sorting, resume last material, play/pause, delete audio or whole material | A → B → translation, contextual lookup, failed/partial/cancelled/late responses, stale data and explicit retry |
| Learning | Reveal, four grades, 10-card completion, switching modes, restart/resume, continue/exit, progress reset | Fixed queue, due dates, SM-2, idempotent ratings, deletion during a session |
| Navigation/settings | Three modes, nested screens, prompts/temperature save and restore, external link handlers | Parameter/schema validation and SQLite transactions/migrations |

The offline layer runs the existing TypeScript domain tests from pytest and adds realistic fixture scenarios. It never substitutes a Python copy of the business logic and never calls a provider. Android tests do **not** cover the A/B text-selection interface with a populated transcript: its processing and contextual lookup are covered at the domain boundary with injected responses. External-link tests verify that Android opens a handler and the app can be resumed, not the content/uptime of third-party websites. Speech quality and AI quality are outside this suite.

## Requirements

- Python 3.10 or later and packages from `tests/requirements.txt`
- Node.js and Appium Server on `PATH`, with the UiAutomator2 driver installed
- Android SDK Platform Tools (`adb`) and an Android 14+ emulator (API 34+)
- An APK built by the normal EAS preview workflow

One-time setup:

```bash
python3 -m pip install -r tests/requirements.txt
npm install --global appium
appium driver install uiautomator2
```

For local checks without an emulator or APK, run `pnpm install` first, then:

```bash
bash scripts/run-tests.sh --local
# equivalent entry point:
pnpm run test:android --local
```

These local checks require a Node.js version that supports `node:sqlite` (the same Node 22.13+ / 24+ setup as the application). They use in-memory databases and simulated responses. No API key is needed.

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

Or select both the UI and offline checks for a mode:

```bash
bash scripts/run-tests.sh -m dictionary
bash scripts/run-tests.sh -m materials
bash scripts/run-tests.sh -m learning
```

Standard pytest flags work, for example `--junitxml=test-results/android.xml`.
The suite assumes a default EN/RU test installation. External-link checks require
a browser/Telegram link handler on the emulator. These tests modify test-only
settings and restore defaults, so do not use your personal installation.
