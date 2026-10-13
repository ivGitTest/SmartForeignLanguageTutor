# Smart Lang Tutor

Android MVP без собственного сервера/авторизации. Словарь и обучение офлайн; ИИ использует собственный пользовательский OpenRouter-ключ, вводимый только в нативном приложении.

Из корня monorepo:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/mobile-app run typecheck
pnpm --filter @workspace/mobile-app test
pnpm --filter @workspace/mobile-app run dev
```

Код приложения — `app/`, общие компоненты — `components/`, доменная логика, SQLite и провайдер — `core/`. Название интерфейса и установленного APK — единый `constants/app-name.json`.

Согласованные требования — `../../docs/mvp/`. Статус и границы проверок — `../../docs/mvp/implementation-and-verification.md`; подключение аккаунта и команды APK — `../../docs/mvp/expo-build-runbook.md`.

Ключи и серверную авторизацию прототипа сюда не переносить. Не сохранять ключ в `.env`, исходники, SQLite, AsyncStorage или EAS env. APK не зависит от работающего Replit-сервера/Metro. Browser preview не поддерживает запись и защищённое хранение ключа.
