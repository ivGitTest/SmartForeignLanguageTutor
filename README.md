[English](#english) · [Русский](#русский)

# English

## Smart Lang Tutor

Smart Lang Tutor is an Android app for turning short spoken English recordings into a verbatim transcript, a B1 → B2 rewrite, a Russian translation, and vocabulary cards for spaced repetition.

The app has three independent modes: **Dictionary**, **Materials**, and **Learning**. It opens in Dictionary. MVP settings are fixed to an English interface, English learning content, Russian as the native/translation language, B1 → B2, and a light theme.

## Main features

- Record one English speaker for up to 2 minutes. Recordings are kept in the app’s private storage and can be played back locally.
- Create **A**, the English transcription, from saved audio. A is editable so corrections can be made before improvement.
- Create **B**, an English rewrite from the current A, targeting B2 from B1. B is intended to improve grammar and naturalness without changing the speaker’s meaning; the model cannot guarantee perfect preservation.
- Generate a Russian translation of B after a successful improvement. The translation is collapsed by default.
- Select a word or phrase in B to request a contextual Russian translation and add it to the Dictionary with its example sentence.
- Add, search, edit, and delete vocabulary cards manually. Manual card creation does not require AI.
- Study cards with the SM-2 spaced-repetition algorithm. Due cards are shown before new cards; a session contains up to 10 unique cards. Rate recall as Again, Hard, Good, or Easy. Session position and review progress are saved.
- Choose a model from a restricted list for transcription (A) and another restricted list for improvement and translation (B). The app displays available model pricing when the OpenRouter catalog can be reached.
- Store the user’s OpenRouter key in Android-protected storage. There is no app account, sign-in, or application backend.

Users can choose models, but **cannot edit AI prompts or generation parameters in the app**. Those values are fixed internally for the MVP. Restoring defaults resets the model and internal AI defaults without deleting vocabulary, materials, progress, or the saved key.

### Configure AI defaults (developers)

AI prompt text and request parameters are kept outside the TypeScript source:

- `config/ai-prompts.json` — B improvement, full translation, and contextual translation instructions.
- `config/ai-parameters.json` — A transcription temperature, B generation parameters, and translation parameters. Contextual translation uses the same parameter set as full translation.

Edit the JSON values, then rebuild and reinstall the app for the changes to take effect. The app validates these files at startup: A temperature must be 0–1; text-model temperature 0–2; `top_p` greater than 0 and up to 1; `max_tokens` 64–4096; optional `seed` 0–2147483647. The model lists and validation rules remain in the app source.

### Configure app information for a fork

Edit `config/app_info.json` to set the developer name and support contact shown on the Settings screen. Set `developerName`, `supportLabel`, and `supportUrl` together; the displayed support link and its destination come from this file. Rebuild the app after editing.

## AI workflow

1. **Record and save audio.** Recording is a local Android operation. No audio is sent until the user starts transcription.
2. **Transcribe to A.** The app sends the selected audio and English-language setting to the chosen speech-to-text model through OpenRouter. The result is saved as A on the device.
3. **Improve to B.** The app sends the current A, the fixed B1 → B2 target, and the built-in instruction to the chosen text model. B is created only from A, never directly from audio.
4. **Translate B.** After a complete B is saved, the app sends B to the selected text model for English-to-Russian translation. A translation failure does not discard B.
5. **Translate a selected expression.** When requested from B, the app sends the selected expression and its sentence context for a contextual Russian translation. The user can add that result to the local Dictionary.

AI operations require an internet connection and the user’s OpenRouter key. Requests go from the app to OpenRouter and may be routed to the selected model provider. Audio or text is sent only for the requested operation. Provider retention policies may vary. AI usage is billed to the user’s OpenRouter account; cancellation or an error does not guarantee that a request was not billed. The app does not automatically retry failed AI requests or silently switch models.

## Offline and online availability

| Works offline | Requires internet / AI provider |
|---|---|
| Browse, search, add, edit, and delete Dictionary cards | Transcribe audio into A |
| Study saved cards and save SM-2 progress | Improve A into B |
| Record audio and play saved audio on Android | Translate B into Russian |
| View and edit already-saved A; view saved B and translations | Contextually translate a selected expression |
| Manage local materials and restore app defaults | Connect/verify an OpenRouter key; refresh model availability and pricing |
| Speak text when a compatible English system voice is installed locally | Download or use a network-only system voice, if that is what Android provides |

The Android app uses SQLite for learning data and private app files for audio. Data is not cloud-synced or automatically backed up; uninstalling the app or clearing its data can remove it.

## Repository structure

```text
artifacts/mobile-app/
├── app/                    Expo Router screens and routes
│   ├── (tabs)/              Dictionary, Materials, Learning
│   ├── material/[id].tsx    Material details: audio, A, B, translation
│   ├── word/[id].tsx        Vocabulary card
│   ├── settings.tsx         Privacy, key, models, defaults, app details
│   └── key-connection.tsx   OpenRouter key connection
├── assets/                 App images and fonts
├── components/             Shared UI, recorder, audio player, text selection
├── config/                 Editable app information, AI prompts, and request-parameter defaults
├── constants/              App-wide constants, including the app name
├── core/                   Domain logic, data models, persistence, AI client,
│                           audio files, and SM-2 learning operations
├── hooks/                  Shared React hooks
├── plugins/                Expo config plugins
├── scripts/                APK build and test scripts
├── server/                 Static browser-preview server
└── tests/                  TypeScript domain/SQLite tests, pytest UI tests,
                            and fixtures

docs/mvp/                   MVP requirements and technical documentation
```

## Delivery status and roadmap

### Implemented in the application source

- [x] Dictionary, Materials, and Learning modes with saved local state.
- [x] Android audio recording, local playback, editable A, B generation, and Russian translation flow.
- [x] Contextual translation and adding vocabulary from B.
- [x] SM-2 reviews with saved progress and sessions of up to 10 cards.
- [x] OpenRouter connection, protected key storage, and restricted A/B model lists.
- [x] Fixed MVP languages and level: English interface, English learning, Russian translation, B1 → B2.

These checkboxes describe the code, **not completed device acceptance**.

### Still required before full MVP acceptance

- [ ] Build and install a preview APK with Expo EAS.
- [ ] Verify recording, playback, SQLite persistence, permissions, interruptions, and protected key storage on Android 13/14.
- [ ] Test each enabled model with real requests: transcript fidelity, B1 → B2 meaning preservation, Russian translation, contextual translation, and provider errors.
- [ ] Complete Android layout, offline, backup, and privacy checks. Real AI requests and device acceptance have not yet been completed.

### Planned after the MVP

- [ ] Add interface-language selection and Russian localization; Russian is the default.
- [ ] Add other learning languages, native/translation language options, and AI providers.
- [ ] Add other CEFR improvement-level pairs, such as B1 → C1.
- [ ] Add FSRS as another spaced-repetition algorithm.
- [ ] Export vocabulary in an Anki-compatible format.
- [ ] Export materials to CSV, including ID, date/time, original text, and improved text.
- [ ] Let users configure the number of cards in a learning session.
- [ ] Let users choose where audio recordings are stored.
- [ ] Add system and dark themes.

## Development checks

Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/mobile-app run typecheck
pnpm --filter @workspace/mobile-app run test
```

Product scope and technical decisions are in [`docs/mvp/`](../../docs/mvp/).

## Build an APK

The repository uses pnpm workspaces. Install dependencies from the repository root, then start an Android preview build:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/mobile-app run build:apk
```

The build runs through Expo EAS and requires access to the Expo project configured for this app. A fork must be linked to its own Expo project and have its app configuration and build settings updated before building. See the Expo EAS documentation for account setup and build requirements.

# Русский

## Smart Lang Tutor

Smart Lang Tutor — Android-приложение, которое превращает короткую запись речи на английском в транскрибацию, улучшенный вариант уровня B2, перевод на русский и карточки слов для интервального повторения.

В приложении три независимых режима: **Словарь**, **Материалы** и **Обучение**. При запуске открывается Словарь. В MVP зафиксированы английский интерфейс и язык обучения, русский язык перевода, улучшение B1 → B2 и светлая тема.

## Основные функции

- Запись речи одного человека на английском длительностью до 2 минут. Аудио хранится в приватном каталоге приложения и воспроизводится локально.
- Создание **А** — английской транскрибации — из сохранённого аудио. Текст А можно исправить перед улучшением.
- Создание **Б** — улучшенного английского текста на основе текущего А, с уровня B1 до B2. Задача модели — улучшить грамматику и естественность, сохранив смысл; безошибочное сохранение смысла не гарантируется.
- Перевод Б на русский после успешного улучшения. Перевод свёрнут по умолчанию.
- Выделение слова или выражения в Б для контекстного перевода на русский и добавления в Словарь вместе с примером из предложения.
- Ручное добавление, поиск, редактирование и удаление карточек. Для ручного создания карточки ИИ не требуется.
- Обучение по алгоритму интервального повторения SM-2. Сначала показываются карточки с наступившим сроком, затем новые; в сессии — не более 10 уникальных карточек. Оценки: Again, Hard, Good, Easy. Позиция сессии и прогресс сохраняются.
- Выбор модели из ограниченного списка для распознавания (А) и отдельного списка для улучшения и перевода (Б). При доступе к каталогу OpenRouter приложение показывает сведения о тарифах моделей.
- Хранение собственного ключа OpenRouter в защищённом хранилище Android. В приложении нет регистрации, входа и собственного backend.

Пользователь может выбирать модели, но **не может редактировать промпты ИИ или параметры генерации в приложении**. Для MVP эти значения заданы внутри приложения. Восстановление настроек по умолчанию сбрасывает выбор моделей и внутренние AI-настройки, но не удаляет словарь, материалы, прогресс или сохранённый ключ.

### Настройка AI-параметров разработчиком

Тексты промптов и значения параметров запросов вынесены из TypeScript-кода:

- `config/ai-prompts.json` — инструкции для улучшения Б, полного перевода и контекстного перевода.
- `config/ai-parameters.json` — температура транскрибации А, параметры генерации Б и параметры перевода. Контекстный перевод использует тот же набор параметров, что и полный перевод.

Измените значения в JSON, затем пересоберите и переустановите приложение. При запуске приложение проверяет файлы: температура А — 0–1; температура текстовой модели — 0–2; `top_p` — больше 0 и не выше 1; `max_tokens` — 64–4096; необязательный `seed` — 0–2147483647. Списки моделей и правила проверки остаются в исходном коде.

### Настройка информации о приложении для форка

Измените `config/app_info.json`, чтобы задать имя разработчика и контакт поддержки, которые показываются на экране Settings. Укажите `developerName`, `supportLabel` и `supportUrl`; подпись ссылки и её адрес берутся из этого файла. После изменения пересоберите приложение.

## Как работают ИИ-операции

1. **Запись и сохранение аудио.** Запись выполняется локально на Android. Аудио не отправляется, пока пользователь не запускает транскрибацию.
2. **Транскрибация в А.** Приложение отправляет выбранную аудиозапись и язык English выбранной модели распознавания через OpenRouter. Результат сохраняется на устройстве как А.
3. **Улучшение в Б.** Приложение отправляет текущий текст А, заданную пару B1 → B2 и встроенную инструкцию выбранной текстовой модели. Б создаётся только на основе А, напрямую из аудио улучшение не запускается.
4. **Перевод Б.** После сохранения завершённого Б приложение отправляет его выбранной текстовой модели для перевода с английского на русский. Ошибка перевода не удаляет Б.
5. **Перевод выражения.** По запросу из Б приложение отправляет выделенное выражение и предложение-контекст для контекстного перевода на русский. Результат можно добавить в локальный Словарь.

Для ИИ нужны интернет и собственный ключ OpenRouter. Запросы идут из приложения в OpenRouter и могут маршрутизироваться выбранному поставщику модели. Отправляются только данные, необходимые для запрошенной операции. Правила хранения данных у поставщиков различаются. ИИ оплачивается из аккаунта OpenRouter пользователя; отмена или ошибка не гарантирует, что запрос не был тарифицирован. Приложение не повторяет неудачные запросы автоматически и не подменяет выбранную модель без уведомления.

## Работа без интернета и с интернетом

| Работает офлайн | Нужны интернет и/или поставщик ИИ |
|---|---|
| Просмотр, поиск, добавление, редактирование и удаление карточек | Транскрибация аудио в А |
| Обучение по сохранённым карточкам и запись прогресса SM-2 | Улучшение А в Б |
| Запись аудио и локальное воспроизведение на Android | Перевод Б на русский |
| Просмотр и редактирование сохранённого А; просмотр сохранённых Б и переводов | Контекстный перевод выделенного выражения |
| Работа с локальными материалами и восстановление настроек | Подключение/проверка ключа OpenRouter; обновление доступности и тарифов моделей |
| Озвучивание текста при наличии установленного локального английского голоса | Загрузка или использование сетевого системного голоса, если Android предоставляет такой вариант |

Android-приложение хранит учебные данные в SQLite, аудио — в приватных файлах приложения. Облачной синхронизации и автоматических резервных копий нет; удаление приложения или его данных может привести к потере сохранённых данных.

## Структура репозитория

```text
artifacts/mobile-app/
├── app/                    Экраны и маршруты Expo Router
│   ├── (tabs)/              Словарь, Материалы, Обучение
│   ├── material/[id].tsx    Материал: аудио, А, Б, перевод
│   ├── word/[id].tsx        Карточка слова
│   ├── settings.tsx         Приватность, ключ, модели, сброс, сведения о приложении
│   └── key-connection.tsx   Подключение ключа OpenRouter
├── assets/                 Изображения и шрифты приложения
├── components/             Общий UI, запись, аудиоплеер, выделение текста
├── constants/              Общие константы, включая название приложения
├── core/                   Доменная логика, модели данных, хранение, AI-клиент,
│                           аудиофайлы и операции SM-2
├── hooks/                  Общие React hooks
├── plugins/                Конфигурационные плагины Expo
├── scripts/                Скрипты сборки APK и тестирования
├── server/                 Сервер статического browser preview, не AI backend
└── tests/                  TypeScript-тесты домена/SQLite, pytest UI-тесты,
                            тестовые данные

docs/mvp/                   Согласованные требования MVP и инструкция сборки
```

## Статус реализации и план

### Реализовано в исходном коде приложения

- [x] Режимы Словарь, Материалы и Обучение с сохранением локального состояния.
- [x] Запись аудио на Android, локальное воспроизведение, редактируемое А, генерация Б и перевод на русский.
- [x] Контекстный перевод и добавление слов в Словарь из Б.
- [x] Повторение по SM-2 с сохранением прогресса и сессиями до 10 карточек.
- [x] Подключение OpenRouter, защищённое хранение ключа, ограниченные списки моделей А/Б.
- [x] Фиксированные настройки MVP: интерфейс и обучение на английском, перевод на русский, B1 → B2.

Отметки означают, что функция присутствует в коде, **но не подтверждают приёмку на устройстве**.

### Осталось до полной приёмки MVP

- [ ] Собрать и установить preview APK через Expo EAS.
- [ ] Проверить на Android 13/14 запись, воспроизведение, сохранение SQLite, разрешения, прерывания и защищённое хранение ключа.
- [ ] Проверить каждую включённую модель реальными запросами: точность транскрибации, сохранение смысла при B1 → B2, перевод на русский, контекстный перевод и ошибки поставщиков.
- [ ] Завершить проверки компоновки Android, офлайн-сценариев, резервного копирования и приватности. Реальные запросы ИИ и приёмка на устройстве ещё не выполнены.

### Запланировано после MVP

- [ ] Выбор языка интерфейса и локализация на русский; русский — по умолчанию.
- [ ] Поддержка других языков обучения, родного языка и языка перевода, а также провайдеров ИИ.
- [ ] Другие пары уровней CEFR, например B1 → C1.
- [ ] Поддержка FSRS как дополнительного алгоритма интервального повторения.
- [ ] Экспорт словаря в формате, совместимом с Anki.
- [ ] Экспорт материалов в CSV: ID, дата и время, исходный и улучшенный тексты.
- [ ] Настройка количества карточек в учебной сессии.
- [ ] Выбор места хранения аудиозаписей.
- [ ] Системная и тёмная темы.

## Команды проверки

Запускать из корня репозитория:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/mobile-app run typecheck
pnpm --filter @workspace/mobile-app run test
```

Для сборки APK установите зависимости и запустите `pnpm --filter @workspace/mobile-app run build:apk` из корня репозитория. Сборка выполняется через Expo EAS и требует доступа к настроенному проекту Expo. Для форка подключите собственный проект Expo и обновите конфигурацию приложения и сборки. Подробности — в документации Expo EAS. Требования и технические решения находятся в [`docs/mvp/`](../../docs/mvp/).
