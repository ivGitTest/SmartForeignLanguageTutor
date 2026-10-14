# Android UI tests

One pytest command runs the offline/domain checks every time. If `SMART_LANG_TUTOR_APK` points to an APK, the same run also checks that an Android target and Appium are ready, installs the APK, and runs the UI checks. The Android checks cover Dictionary, Materials, Learning, navigation, local storage, and native audio recording. Speech recognition, improvement, translation, and model execution are never started. Opening Settings can read the public model catalog; the tests do not enter or transmit a user key.

There are two layers:

| Group | Android UI checks | Offline checks using the real application domain |
| --- | --- | --- |
| Dictionary | Required fields, duplicate detection, create/edit/search/delete, add-card route | Selection context, normalized expressions, populated dictionary and durable storage |
| Materials | Record/stop/discard/save, title, search, newest-first sorting, resume last material, play/pause, delete audio or whole material | A → B → translation, contextual lookup, failed/partial/cancelled/late responses, stale data and explicit retry |
| Learning | Reveal, four grades, 10-card completion, switching modes, restart/resume, continue/exit, progress reset | Fixed queue, due dates, SM-2, idempotent ratings, deletion during a session |
| Navigation/settings | All page routes; tab round trips; toolbar and Android Back from materials (idle/playing), new/existing word cards, Settings and nested settings; unsaved-card confirmation; missing-route exits; prompts save/restore and external links | Native-player lifecycle regression, page/test inventory, parameter/schema validation and SQLite transactions/migrations |

The offline layer runs the existing TypeScript domain tests from pytest and adds realistic fixture scenarios. It never substitutes a Python copy of the business logic and never calls a provider. Android tests do **not** cover the A/B text-selection interface with a populated transcript: its processing and contextual lookup are covered at the domain boundary with injected responses. External-link tests verify that Android opens a handler and the app can be resumed, not the content/uptime of third-party websites. Speech quality and AI quality are outside this suite.

## Requirements

- Python 3.10 or later and packages from `tests/requirements.txt`
- pnpm dependencies installed from the repository root (the offline tests call the actual TypeScript app domain)
- For Android checks only: Node.js, Appium Server, Android SDK Platform Tools, and an Android 14+ emulator (API 34+)

One-time setup:

```bash
python3 -m pip install -r artifacts/mobile-app/tests/requirements.txt
npm install --global appium
appium driver install uiautomator2
```

Run the same command from the repository root in both cases:

```bash
pnpm --filter @workspace/mobile-app run test
```

With `SMART_LANG_TUTOR_APK` set and an emulator running, the Android UI checks are added automatically:
```bash
SMART_LANG_TUTOR_APK="/path/to/smart-lang-tutor.apk" \
ANDROID_SERIAL="emulator-5554" \
pnpm --filter @workspace/mobile-app run test
```

`ANDROID_SERIAL` is the device ID shown by `adb devices`. The script installs the APK as an update (`adb install -r`) and grants microphone permission for the recording test. It never clears application data or uninstalls the app. Use a clean test installation with an empty Dictionary and Materials list: pytest checks both screens first and refuses to modify an app that already contains user data.

Without `SMART_LANG_TUTOR_APK`, the Android tests are reported as skipped and the offline checks still run. This is not a second test suite or a second command: Android checks need a device and installed APK; offline checks run on any machine.

Run just the navigation checks (including local lifecycle checks and the route inventory):

```bash
SMART_LANG_TUTOR_APK="/path/to/smart-lang-tutor.apk" \
ANDROID_SERIAL="emulator-5554" \
pnpm --filter @workspace/mobile-app run test -m navigation
```

The toolbar Back tests click the native toolbar button; they do not substitute
`driver.back()`. Both paths are tested independently. Every `app/**/*.tsx` page
must be registered in `SCREEN_TESTS` in `test_navigation.py`; the local inventory
test fails when a page is added without a test registration. The inventory and
mocked native lifecycle test do not prove that navigation works on a device:
only an executed APK/UI run can confirm that.

The recording test uses the emulator microphone, creates short local recordings, and deletes them. If a test fails partway through, some test-labelled records may remain; review the emulator before rerunning. Never point the suite at an app with personal data. A physical device is rejected by default; to opt in deliberately, set `SMART_LANG_E2E_ALLOW_PHYSICAL_DEVICE=1` after confirming the Dictionary and Materials are empty. That device's microphone permission and the app's first-use microphone notice may change.

Test phrases and Russian meanings are in `tests/fixtures/sample-data.json`. Words are created through the app's own forms and removed when the session fixture ends. Materials are created by recording through the native UI, not seeded through a test-only app backdoor. Since A cannot be entered until transcription, the tests leave A/B/translation empty rather than calling an AI provider.

To run only one functional group, keep the APK and emulator variables and pass a file:

```bash
SMART_LANG_TUTOR_APK="/path/to/smart-lang-tutor.apk" \
ANDROID_SERIAL="emulator-5554" \
pnpm --filter @workspace/mobile-app run test -- -m dictionary
```

Or select both the UI and offline checks for a mode:

```bash
pnpm --filter @workspace/mobile-app run test -- -m dictionary
pnpm --filter @workspace/mobile-app run test -- -m materials
pnpm --filter @workspace/mobile-app run test -- -m learning
```

Standard pytest flags work, for example `--junitxml=test-results/android.xml`.
The suite assumes a default EN/RU test installation. External-link checks require
a browser/Telegram link handler on the emulator. These tests modify test-only
settings and restore defaults, so do not use your personal installation.
