# Android APK — сборка через Expo EAS

## Что подготовлено и чего ещё нет

Сборки выполняются в вашем аккаунте Expo через **EAS Build**. Собственный сервер, Android Studio, локальный Android SDK и аккаунт Google Play для облачной сборки APK не нужны.

Реализована кодовая версия MVP: Словарь, Обучение SM-2, Материалы, прямой OpenRouter, настройки и защищённое хранение ключа. Подробный статус — [реализация и проверки](implementation-and-verification.md). **Первый APK и работа на устройстве ещё не проверены**: успешный JS export не заменяет облачную компиляцию и приёмку Android.

- Приложение: `artifacts/mobile-app`, Expo SDK 57; pnpm monorepo.
- Конфигурация сборки: `artifacts/mobile-app/eas.json`.
- Профили `preview` и `production` оба создают подписанный **APK**, не AAB. Это обычные standalone-сборки: Expo Go и работающий Metro для запуска не нужны.
- Node 24.13.0, pnpm 10.26.1, EAS CLI 24.13.0. CLI вызывается через `pnpm dlx`, глобальная установка не нужна.
- Название — `Smart Lang Tutor`, единый источник `constants/app-name.json` для интерфейса и Expo config. Slug `smartlang`, владелец Expo `ivaexpi`, EAS project ID `24594e06-57d4-416b-9f3e-5f212b9c2cd5`. Android package: `com.englishlab.mobile`; если уже есть выпущенное приложение, **до первой сборки** сверить package и signing credentials с прежним приложением.

Облачные сборки расходуют квоту вашего тарифного плана; условия и стоимость: <https://expo.dev/pricing>. Эти инструкции не запускают сборку автоматически.

### Проверено при подготовке

Проверены public config Expo, типы приложения, оба профиля валидатором EAS CLI и правила архивирования самим matcher EAS CLI. `expo export --platform android` успешно создал Android JS-бандл. Это не компиляция APK и не проверка на реальном Android.

Конфигурация приложения привязана к предоставленным slug, owner и project ID. В текущей среде нет авторизации Expo: владельца и доступ к проекту серверно проверить не удалось. Перед сборкой выполнить `pnpm run eas:login`, затем `pnpm run eas:whoami` и убедиться, что вывод — `ivaexpi`. Preview приложения открывается. В Replit есть отдельное предупреждение React Native DevTools о недостающей `libglib-2.0.so.0`; Metro и Android JS export работают. Предупреждение относится к локальному отладчику, а не к проверке облачной сборки.

## 1. Где выполнять команды

В терминале Replit или локально из клона **всего репозитория**. Нужны корневые `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.npmrc` и `.easignore`; мобильное приложение больше не зависит от workspace-библиотек `lib/*`.

Если зависимости не установлены, сначала из корня:

```bash
pnpm install --frozen-lockfile
```

Все дальнейшие EAS-команды выполнять из папки мобильного приложения:

```bash
cd artifacts/mobile-app
```

Не использовать `pnpm run build` для APK: существующий скрипт `build` обслуживает веб-сборку Replit.

## 2. Войти в свой Expo-аккаунт

```bash
pnpm run eas:login
pnpm run eas:whoami
```

Вход использует device flow: CLI даёт инструкции для входа через браузер на вашем устройстве. Следовать им в терминале/браузере, не отправлять пароль, токен или код входа в чат.

Проверить, что `whoami` показывает именно ваш аккаунт, а не другую ранее сохранённую сессию. При необходимости:

```bash
pnpm dlx eas-cli@24.13.0 logout
pnpm run eas:login
```

## 3. Проверить существующую привязку

Проект EAS уже указан в конфигурации приложения по предоставленным реквизитам. Не запускайте `eas init` для создания другого проекта. После `eas:login` проверьте `eas:whoami` и конфигурацию командами ниже. Project ID/package — публичные идентификаторы, не API-ключи. `eas build:configure` повторно запускать не требуется: `eas.json` уже подготовлен.

## 4. Проверить конфигурацию и архив

```bash
pnpm exec expo config --type public
pnpm run typecheck
pnpm dlx expo-doctor@latest
pnpm dlx eas-cli@24.13.0 config --platform android --profile preview
```

Затем собрать **локальный архив исходников**, без облачной компиляции:

```bash
pnpm dlx eas-cli@24.13.0 build:inspect \
  --platform android \
  --profile preview \
  --stage archive \
  --output ../../generated-artifacts/eas-archive
```

Если каталог уже существует, удалить/переименовать его вручную либо выбрать другое имя; `--force` не добавлять без необходимости.

Проверить состав архива: есть исходники и assets мобильного приложения и корневые pnpm-файлы; нет `.env`, ключей/keystore, `credentials.json`, `.agents`, `.local`, `attached_assets`, логов, документации, `lib/`, служебных скриптов и остальных приложений.

**Важно:** корневая `.easignore` заменяет `.gitignore` для EAS, а не дополняет её. Новые исключения чувствительных файлов добавлять в обе. Для текущего monorepo правило находится в корне Git-репозитория, не рядом с `eas.json`.

## 5. Собрать APK для проверки

Эта команда уже запускает облачную сборку и расходует квоту:

```bash
pnpm run build:apk
```

Команда проверит публичную конфигурацию Expo и авторизованный аккаунт (`ivaexpi`), затем запустит Android APK с профилем `preview`. Если вы не вошли, выполните сначала `pnpm run eas:login`. Скрипт: `artifacts/mobile-app/scripts/build-apk.sh`.

На первом запуске выбрать генерацию нового Android keystore средствами EAS, **только если приложение новое**. Для ранее выпущенного приложения использовать исходные signing credentials. Не создавать другую подпись для обновления установленного APK.

Номер Android-сборки ведётся удалённо EAS и увеличивается автоматически. Пользовательская версия остаётся из `app.json`; изменять её перед новым выпуском.

Для APK в окружении production:

```bash
pnpm run build:apk:production
```

Профиль production тоже предназначен для прямой установки APK, не для Google Play. Публикации в магазин, `eas submit`, OTA-обновлений и автоматических сборок сейчас нет.

## 6. Статус, скачивание и установка

```bash
pnpm run build:list
pnpm dlx eas-cli@24.13.0 build:view ВАШ_BUILD_ID
```

Открыть страницу сборки по ссылке CLI, дождаться `Finished`, скачать `.apk`. Успешная отправка задания ещё не означает успешную компиляцию.

Открыть ссылку на APK на Android и разрешить установку из этого источника. Либо с подключённым телефоном и установленным adb:

```bash
adb install -r /путь/к/приложению.apk
```

`-r` устанавливает совместимое обновление поверх приложения; совпадение package и подписи обязательно. **Не удалять установленное приложение как первый способ решения ошибки:** удаление уничтожает его локальные данные и ключ. Сам по себе `-r` не проверяет корректность будущих миграций SQLite.

## 7. Ключи и подпись

- Не добавлять `OPENROUTER_API_KEY`, `SESSION_SECRET` и ключи прототипа в app config, `eas.json`, EAS environment или `EXPO_PUBLIC_*`. Они не нужны для APK.
- Пользовательский ключ OpenRouter вводится через **Settings → Connect or manage key** в нативном приложении и хранится в SecureStore/Keystore; в браузерном preview сохранение ключа намеренно недоступно. Перед проверкой ключа нужно принять уведомление о передаче данных. Одного исключения файлов из архива для этой защиты недостаточно.
- Expo-вход выполняется CLI. Для этой ручной схемы `EXPO_TOKEN` в репозитории/Replit не требуется.
- Signing credentials хранятся у EAS; управление: `pnpm dlx eas-cli@24.13.0 credentials --platform android`. Не скачивать их в Git/чат. Владельцу проекта нужно обеспечить восстановление доступа к подписи.
- Сборка содержит исходники, assets и публичные идентификаторы. Любые секреты, попавшие в JS/config, можно извлечь из APK; «secret» visibility переменной EAS не защищает значение, если оно встроено в клиент.

## 8. Обычный запуск для разработки

Локально:

```bash
pnpm run start:local
```

В Replit использовать существующий workflow `artifacts/mobile-app: expo`: он сохраняет настройки прокси. `start:local` не является заменой этого workflow. Для проверки установленного standalone APK dev server не нужен.

## Источники

- <https://docs.expo.dev/build-reference/apk/>
- <https://docs.expo.dev/build-reference/build-with-monorepos/>
- <https://docs.expo.dev/build-reference/easignore/>
- <https://docs.expo.dev/build/setup/>
