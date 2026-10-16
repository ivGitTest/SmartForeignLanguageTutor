[English](#english) · [Русский](#русский)

# English

## For users

### Smart Lang Tutor

Smart Lang Tutor is an Android app for turning short spoken English recordings into a verbatim transcript, a B1 → B2 rewrite, a Russian translation, and vocabulary cards for spaced repetition.

The app has three independent modes: **Dictionary**, **Materials**, and **Learning**. It opens in Dictionary. MVP settings are fixed to an English interface, English learning content, Russian as the native/translation language, B1 → B2, and a light theme.

### Main features

- Record one English speaker for up to 2 minutes. Recordings are kept in the app’s private storage and can be played back locally.
- Create **A**, the English transcription, from saved audio. A is editable so corrections can be made before improvement.
- Create **B**, an English rewrite from the current A, targeting B2 from B1. B is intended to improve grammar and naturalness without changing the speaker’s meaning; the model cannot guarantee perfect preservation.
- Generate a Russian translation of B after a successful improvement. The translation is collapsed by default.
- Select a word or phrase in B to request a contextual Russian translation and add it to the Dictionary with its example sentence.
- Add, search, edit, and delete vocabulary cards manually. Manual card creation does not require AI.
- Study cards with the SM-2 spaced-repetition algorithm. Due cards are shown before new cards; a session contains up to 10 unique cards. Rate recall as Again, Hard, Good, or Easy. Session position and review progress are saved.
- Choose a model from a restricted list for transcription (A) and another restricted list for improvement and translation (B). The app displays available model pricing when the OpenRouter catalog can be reached.
- Store the user’s OpenRouter key in Android-protected storage. There is no app account, sign-in, or application backend.

### Why use this learning approach?

The app starts from what you want to say, rather than from unrelated example sentences. You speak naturally, review the transcription, then compare it with an English version adapted from B1 to B2. That connects speaking practice with noticing how to express your own ideas at the target level.

Words and phrases can be saved from the improved text together with their sentence context. The Learning mode brings saved cards back for active recall on an SM-2 schedule, combining speaking, vocabulary, and spaced review in one workflow. Regular short sessions can help build a study habit and reinforce recall; results depend on the learner and the quality of each AI response.

### Requirements and limitations

- AI actions require an internet connection and your own OpenRouter API key. The app sends audio or text to OpenRouter only when you start the matching AI action; requests may be routed to a model provider. AI usage is billed to your OpenRouter account, and provider data-retention rules may vary.
- To create a key, sign in to [OpenRouter](https://openrouter.ai/) and use its [API Keys page](https://openrouter.ai/keys). The [official authentication guide](https://openrouter.ai/docs/api_reference/authentication) explains key use and limits. Create a key, set a spending limit, then enter it in the app under **Settings → Connect or manage key**. Never put a personal key in source code or commit it to a repository.
- The MVP supports **English as the only learning language**. The interface is English and the translation/native language is fixed to Russian.
- The MVP supports **one CEFR level pair: B1 → B2**. Learners cannot select other current or target levels yet.
- AI-generated text can contain mistakes or change meaning. Check the transcript and improved text before relying on them.
- Learning data is stored locally on the device, with no cloud sync or automatic backup. Clearing app data or uninstalling the app removes it.

### AI workflow

1. **Record and save audio.** Recording is a local Android operation. No audio is sent until the user starts transcription.
2. **Transcribe to A.** The app sends the selected audio and English-language setting to the chosen speech-to-text model through OpenRouter. The result is saved as A on the device.
3. **Improve to B.** The app sends the current A and fixed B1 → B2 target to the chosen text model. B is created only from A, never directly from audio.
4. **Translate B.** After a complete B is saved, the app sends B to the selected text model for English-to-Russian translation. A translation failure does not discard B.
5. **Translate a selected expression.** When requested from B, the app sends the selected expression and its sentence context for a contextual Russian translation. The user can add that result to the local Dictionary.

The app does not automatically retry failed AI requests or silently switch models. Cancelling an operation or receiving an error does not guarantee that the request was not billed.

### Offline and online availability

| Works offline | Requires internet / AI provider |
|---|---|
| Browse, search, add, edit, and delete Dictionary cards | Transcribe audio into A |
| Study saved cards and save SM-2 progress | Improve A into B |
| Record audio and play saved audio on Android | Translate B into Russian |
| View and edit already-saved A; view saved B and translations | Contextually translate a selected expression |
| Manage local materials and restore app defaults | Connect/verify an OpenRouter key; refresh model availability and pricing |
| Speak text when a compatible English system voice is installed locally | Download or use a network-only system voice, if that is what Android provides |

The Android app uses SQLite for learning data and private app files for audio. Data is not cloud-synced or automatically backed up; uninstalling the app or clearing its data can remove it.

## For developers

### AI and app configuration

AI instructions and generation parameters are editable without changing TypeScript:

- `artifacts/mobile-app/config/ai-prompts.json` — instructions for improving B, translating all of B, and translating a selected expression.
- `artifacts/mobile-app/config/ai-parameters.json` — A transcription, B improvement, and translation request parameters. Context translation shares the full-translation parameters.
- `artifacts/mobile-app/config/app_info.json` — developer name and support label/URL displayed in Settings. Update these for a fork.

Edit the JSON and rebuild the application for changes to take effect. The app validates AI parameter values when loading them. Prompts and parameters are not editable by app users; do not put API keys or other secrets in these files.

### Repository structure

```text
.
├── artifacts/mobile-app/
│   ├── app/                  Expo Router screens and routes
│   │   ├── (tabs)/           Dictionary, Materials, Learning
│   │   ├── material/[id].tsx Material details: audio, A, B, translation
│   │   ├── word/[id].tsx     Vocabulary card
│   │   ├── settings.tsx      Privacy, key, models, defaults, app info
│   │   └── key-connection.tsx OpenRouter key connection
│   ├── assets/               App icons and bundled media
│   ├── components/           Shared UI, recorder, audio player, text selection
│   ├── config/               App info, AI prompts, and AI parameters
│   ├── constants/            App-wide constants such as the app name
│   ├── core/                 Domain logic, data model, persistence, AI client,
│   │                         audio storage, and SM-2 operations
│   ├── hooks/                Shared React hooks
│   ├── plugins/              Expo config plugins
│   ├── scripts/              Build and test scripts
│   ├── server/               Static browser-preview server; no AI backend
│   ├── tests/                TypeScript domain/SQLite tests and pytest UI tests
│   ├── app.config.ts         Expo app configuration
│   ├── app_example.json      Example Expo configuration
│   ├── eas.json              EAS Android build profiles
│   └── package.json          App scripts and dependencies
├── pnpm-workspace.yaml       Workspace package configuration
├── pnpm-lock.yaml            Locked dependency versions
├── package.json              Root workspace scripts
└── README.md                 User and developer guide
```

### MVP status and roadmap

The MVP scope is complete:

- [x] Dictionary, Materials, and Learning modes with saved local state.
- [x] Android audio recording, local playback, editable A, B generation, and Russian translation flow.
- [x] Contextual translation and adding vocabulary from B.
- [x] SM-2 reviews with saved progress and sessions of up to 10 cards.
- [x] OpenRouter connection, protected key storage, and restricted A/B model lists.
- [x] Fixed MVP languages and level: English interface, English learning, Russian translation, B1 → B2.

### Planned after the MVP

- [ ] Add interface-language selection and Russian localization; Russian is the default.
- [ ] Add other learning languages, native/translation language options, and AI providers.
- [ ] Let learners select their starting and target CEFR levels and add more level pairs, such as B1 → C1.
- [ ] Add FSRS as another spaced-repetition algorithm.
- [ ] Export vocabulary in an Anki-compatible format.
- [ ] Export materials to CSV, including ID, date/time, original text, and improved text.
- [ ] Let users configure the number of cards in a learning session.
- [ ] Let users choose where audio recordings are stored.
- [ ] Add system and dark themes.

### Development and test checks

Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/mobile-app run typecheck
pnpm --filter @workspace/mobile-app run test
```

The offline/domain checks run without an Android device and do not send AI requests. Android UI tests run only when an APK and a suitable emulator/device are configured; use a clean test installation.

### Build and distribute the Android app

This is a client-side app with no application backend to deploy. Android binaries are built with Expo EAS in the cloud. First install dependencies and sign in to the Expo account that owns the EAS project:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/mobile-app run eas:login
```

For the maintained project, build a preview APK:

```sh
pnpm --filter @workspace/mobile-app run build:apk
```

The helper checks that the current Expo project matches the original EAS project. To build a fork, create or select an EAS project, update the fork's Expo owner/project ID, slug, and unique Android application ID, then sign in and link the project. Run the EAS CLI directly from `artifacts/mobile-app` because the helper is intentionally tied to the maintained project:

```sh
cd artifacts/mobile-app
pnpm dlx eas-cli@24.13.0 login
pnpm dlx eas-cli@24.13.0 init
pnpm dlx eas-cli@24.13.0 build --platform android --profile preview
```

When EAS reports the build is complete, download the APK from the EAS build page and install it on an Android device. The `production` profile also currently creates an APK for internal/direct distribution:

```sh
pnpm --filter @workspace/mobile-app run build:apk:production
```

The current profiles do not produce a Google Play upload. Google Play releases require an Android App Bundle (`.aab`), Play Console setup, signing credentials, and a store listing. Configure the production profile to build an app bundle, then follow [Expo's Google Play submission guide](https://docs.expo.dev/submit/android/) to set up submission. After configuring Play credentials and the EAS submit profile, submit with `pnpm dlx eas-cli@24.13.0 submit --platform android --profile production` from `artifacts/mobile-app`. See also [EAS Build](https://docs.expo.dev/build/introduction/) and [building APKs](https://docs.expo.dev/build-reference/apk/).

# Русский

## Для пользователя

### Smart Lang Tutor

Smart Lang Tutor — Android-приложение, которое превращает короткую запись речи на английском в транскрибацию, улучшенный вариант на уровнь выше, перевод на русский и карточки слов для интервального повторения.

В приложении три независимых режима: **Словарь**, **Материалы** и **Обучение**. При запуске открывается Словарь. В MVP зафиксированы английский интерфейс и язык обучения, русский язык перевода, улучшение B1 → B2 и светлая тема.

### Основные функции

- Запись речи одного человека на английском длительностью до 2 минут. Аудио хранится в приватном каталоге приложения и воспроизводится локально.
- Создание **А** — английской транскрибации — из сохранённого аудио. Текст А можно исправить перед улучшением.
- Создание **Б** — улучшенного английского текста на основе текущего А, с уровня B1 до B2. Задача модели — улучшить грамматику и естественность, сохранив смысл; безошибочное сохранение смысла не гарантируется.
- Перевод Б на русский после успешного улучшения. Перевод свёрнут по умолчанию.
- Выделение слова или выражения в Б для контекстного перевода на русский и добавления в Словарь вместе с примером из предложения.
- Ручное добавление, поиск, редактирование и удаление карточек. Для ручного создания карточки ИИ не требуется.
- Обучение по алгоритму интервального повторения SM-2. Сначала показываются карточки с наступившим сроком, затем новые; в сессии — не более 10 уникальных карточек. Оценки: Again, Hard, Good, Easy. Позиция сессии и прогресс сохраняются.
- Выбор модели из ограниченного списка для распознавания (А) и отдельного списка для улучшения и перевода (Б). При доступе к каталогу OpenRouter приложение показывает сведения о тарифах моделей.
- Хранение собственного ключа OpenRouter в защищённом хранилище Android. В приложении нет регистрации, входа и собственного backend.

### Зачем нужен такой подход?

Приложение начинает не с чужих примеров, а с того, что вы хотите сказать. Вы говорите естественно, проверяете транскрибацию, а затем сравниваете её с английской формулировкой, адаптированной с B1 до B2. Так говорение связывается с осознанным изучением того, как выразить собственные мысли на целевом уровне.

Слова и выражения можно сохранить из улучшенного текста вместе с контекстом предложения. Режим «Обучение» возвращает карточки для активного припоминания по расписанию SM-2. Так в одном процессе сочетаются говорение, изучение слов и интервальное повторение. Регулярные короткие занятия помогают формировать привычку и поддерживать запоминание; результат зависит от учащегося и качества ответов ИИ.

### Требования и ограничения

- Для действий с ИИ нужны интернет и собственный API-ключ OpenRouter. Аудио или текст отправляется в OpenRouter только при запуске соответствующей операции; запрос может быть направлен поставщику модели. Оплата списывается с аккаунта OpenRouter, а правила хранения данных зависят от поставщика.
- Чтобы создать ключ, войдите в [OpenRouter](https://openrouter.ai/) и откройте страницу [API Keys](https://openrouter.ai/keys). В [официальной инструкции по аутентификации](https://openrouter.ai/docs/api_reference/authentication) описаны ключи и лимиты. Создайте ключ, установите лимит расходов и введите его в приложении: **Settings → Connect or manage key**. Не вставляйте личный ключ в исходный код и не добавляйте его в репозиторий.
- В MVP поддерживается **только английский язык для обучения**. Интерфейс приложения на английском, язык перевода/родной язык зафиксирован на русском.
- В MVP доступна **одна пара уровней CEFR: B1 → B2**. Выбрать другой исходный или целевой уровень пока нельзя.
- ИИ может ошибаться или изменить смысл. Перед использованием проверяйте транскрибацию и улучшенный текст.
- Учебные данные хранятся на устройстве; облачной синхронизации и автоматического резервного копирования нет. Очистка данных приложения или его удаление приводит к потере сохранённых данных.

### Как работают ИИ-операции

1. **Запись и сохранение аудио.** Запись выполняется локально на Android. Аудио не отправляется, пока пользователь не запускает транскрибацию.
2. **Транскрибация в А.** Приложение отправляет выбранную аудиозапись и язык English выбранной модели распознавания через OpenRouter. Результат сохраняется на устройстве как А.
3. **Улучшение в Б.** Приложение отправляет текущий текст А и фиксированную пару B1 → B2 выбранной текстовой модели. Б создаётся только на основе А, напрямую из аудио улучшение не запускается.
4. **Перевод Б.** После сохранения завершённого Б приложение отправляет его выбранной текстовой модели для перевода с английского на русский. Ошибка перевода не удаляет Б.
5. **Перевод выражения.** По запросу из Б приложение отправляет выделенное выражение и предложение-контекст для контекстного перевода на русский. Результат можно добавить в локальный Словарь.

Приложение не повторяет неудачные AI-запросы автоматически и не подменяет выбранную модель без уведомления. Отмена операции или ошибка не гарантирует, что запрос не был тарифицирован.

### Работа без интернета и с интернетом

| Работает офлайн | Нужны интернет и/или поставщик ИИ |
|---|---|
| Просмотр, поиск, добавление, редактирование и удаление карточек | Транскрибация аудио в А |
| Обучение по сохранённым карточкам и запись прогресса SM-2 | Улучшение А в Б |
| Запись аудио и локальное воспроизведение на Android | Перевод Б на русский |
| Просмотр и редактирование сохранённого А; просмотр сохранённых Б и переводов | Контекстный перевод выделенного выражения |
| Работа с локальными материалами и восстановление настроек | Подключение/проверка ключа OpenRouter; обновление доступности и тарифов моделей |
| Озвучивание текста при наличии установленного локального английского голоса | Загрузка или использование сетевого системного голоса, если Android предоставляет такой вариант |

Android-приложение хранит учебные данные в SQLite, аудио — в приватных файлах приложения. Облачной синхронизации и автоматических резервных копий нет; удаление приложения или его данных может привести к потере сохранённых данных.

## Для разработчика

### Конфигурация ИИ и приложения

Инструкции для ИИ и параметры генерации редактируются отдельно от TypeScript-кода:

- `artifacts/mobile-app/config/ai-prompts.json` — инструкции для улучшения Б, полного перевода и перевода выделенного выражения.
- `artifacts/mobile-app/config/ai-parameters.json` — параметры транскрибации А, улучшения Б и перевода. Контекстный перевод использует параметры полного перевода.
- `artifacts/mobile-app/config/app_info.json` — имя разработчика и подпись/адрес поддержки на экране Settings. Для форка замените эти значения своими.

После изменения JSON пересоберите приложение. Значения промптов и параметров проверяются при загрузке. Пользователь приложения не может изменять промпты и параметры; не сохраняйте в этих файлах API-ключи и другие секреты.

### Структура репозитория

```text
.
├── artifacts/mobile-app/
│   ├── app/                  Экраны и маршруты Expo Router
│   │   ├── (tabs)/           Словарь, Материалы, Обучение
│   │   ├── material/[id].tsx Материал: аудио, А, Б, перевод
│   │   ├── word/[id].tsx     Карточка слова
│   │   ├── settings.tsx      Приватность, ключ, модели, настройки и сведения о приложении
│   │   └── key-connection.tsx Подключение ключа OpenRouter
│   ├── assets/               Иконки и медиафайлы приложения
│   ├── components/           Общий интерфейс, запись, плеер, выделение текста
│   ├── config/               Информация о приложении, промпты и параметры ИИ
│   ├── constants/            Общие константы, например название приложения
│   ├── core/                 Доменная логика, модель и хранение данных, AI-клиент,
│   │                         аудиофайлы и операции SM-2
│   ├── hooks/                Общие React hooks
│   ├── plugins/              Конфигурационные плагины Expo
│   ├── scripts/              Скрипты сборки и тестирования
│   ├── server/               Сервер статического browser preview; не AI backend
│   ├── tests/                TypeScript-тесты домена/SQLite и pytest UI-тесты
│   ├── app.config.ts         Конфигурация приложения Expo
│   ├── app_example.json      Пример конфигурации Expo
│   ├── eas.json              Профили сборки Android для EAS
│   └── package.json          Скрипты и зависимости приложения
├── package.json              Скрипты корневого workspace
├── pnpm-workspace.yaml       Конфигурация workspace-пакетов
├── pnpm-lock.yaml            Зафиксированные версии зависимостей
└── README.md                 Руководство для пользователей и разработчиков
```

### Статус MVP и планы развития

Функциональность MVP завершена:

- [x] Режимы Словарь, Материалы и Обучение с сохранением локального состояния.
- [x] Запись аудио на Android, локальное воспроизведение, редактируемое А, генерация Б и перевод на русский.
- [x] Контекстный перевод и добавление слов в Словарь из Б.
- [x] Повторение по SM-2 с сохранением прогресса и сессиями до 10 карточек.
- [x] Подключение OpenRouter, защищённое хранение ключа, ограниченные списки моделей А/Б.
- [x] Фиксированные настройки MVP: интерфейс и обучение на английском, перевод на русский, B1 → B2.

### Запланировано после MVP

- [ ] Выбор языка интерфейса и локализация на русский; русский — по умолчанию.
- [ ] Поддержка других языков обучения, родного языка и языка перевода, а также провайдеров ИИ.
- [ ] Выбор исходного и целевого уровней CEFR и добавление других пар, например B1 → C1.
- [ ] Поддержка FSRS как дополнительного алгоритма интервального повторения.
- [ ] Экспорт словаря в формате, совместимом с Anki.
- [ ] Экспорт материалов в CSV: ID, дата и время, исходный и улучшенный тексты.
- [ ] Настройка количества карточек в учебной сессии.
- [ ] Выбор места хранения аудиозаписей.
- [ ] Системная и тёмная темы.

### Проверки и тесты

Запускать из корня репозитория:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/mobile-app run typecheck
pnpm --filter @workspace/mobile-app run test
```

Офлайн-проверки доменной логики запускаются без Android-устройства и не отправляют запросы ИИ. UI-тесты Android запускаются только при наличии APK и настроенного эмулятора или устройства; используйте чистую тестовую установку.

### Сборка и распространение Android-приложения

Это клиентское приложение без собственного backend-сервера. Android-файлы собираются в облаке через Expo EAS. Сначала установите зависимости и войдите в Expo-аккаунт, которому принадлежит EAS-проект:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/mobile-app run eas:login
```

Для поддерживаемого проекта соберите preview APK:

```sh
pnpm --filter @workspace/mobile-app run build:apk
```

Скрипт проверяет, что используется исходный EAS-проект. Для форка создайте или выберите собственный EAS-проект, обновите владельца и ID проекта Expo, slug и уникальный Android application ID, затем войдите в свой аккаунт и свяжите проект. Поскольку вспомогательный скрипт привязан к исходному проекту, запускайте EAS CLI напрямую из `artifacts/mobile-app`:

```sh
cd artifacts/mobile-app
pnpm dlx eas-cli@24.13.0 login
pnpm dlx eas-cli@24.13.0 init
pnpm dlx eas-cli@24.13.0 build --platform android --profile preview
```

После завершения сборки скачайте APK со страницы сборки EAS и установите его на Android-устройство. Профиль `production` сейчас также создаёт APK для внутреннего или прямого распространения:

```sh
pnpm --filter @workspace/mobile-app run build:apk:production
```

Текущие профили не создают пакет для загрузки в Google Play. Для публикации в Google Play нужен Android App Bundle (`.aab`), настройка Play Console, ключи подписи и страница приложения. Перед использованием [инструкции Expo по отправке в Google Play](https://docs.expo.dev/submit/android/) настройте профиль сборки app-bundle. Дополнительно: [EAS Build](https://docs.expo.dev/build/introduction/) и [сборка APK](https://docs.expo.dev/build-reference/apk/).
