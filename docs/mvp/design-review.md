# English Lab — дизайн-ревью Android MVP

**Статус:** 15 экранов подготовлены для ревью. Согласованные требования не менялись; дизайн ожидает отдельного согласования владельцем до реализации.

> **Это review mockups, не production mobile app.** UI-элементы работают только в локальном demo review. Локальное browser-хранилище используется для демонстрационных карточек, учебной позиции, выбранного материала, A, настроек макета и промптов; реальных ключей оно не хранит. Нет реальных запросов к OpenRouter/моделям, API, записи/проигрывания аудио, Android-разрешений, SecureStore/Keystore, SQLite или гарантии персистентности. Не вводите реальные ключи, аудио или личные данные. Модели полностью фиктивны, совместимость неизвестна; тарифы недоступны. Нативная реализация, безопасность и production storage не проверены.

## Реестр экранов и маршрутов

React-превью доступны по `/__mockup/preview/english-lab-mvp/{Component}`. Исходники: [папка макетов](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/), [общие экраны/демо-состояние](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/_shared/screens.tsx), [стили](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/_group.css).

| Component | UI / функциональные связи | Что проверять |
|---|---|---|
| [Dictionary](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/Dictionary.tsx) | UI-08, MODE-01/05, LRN-10 | стартовый список, EN → RU, поиск, динамический resume позиции/оценок |
| [WordCard](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/WordCard.tsx) | UI-09, VOC-04/05/08 | новая карточка `?new=1`, редактирование по выбранному EN-слову, валидация, источник, подтверждение delete/reset |
| [Learning](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/Learning.tsx) | UI-10, LRN-01…12 | фиксированная демо-очередь 10 уникальных EN/RU/example карточек, скрытый перевод, 4 оценки |
| [SessionComplete](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/SessionComplete.tsx) | UI-11, LRN-06/11 | динамический итог/распределение, продолжение новой фиксированной очереди или выход в Dictionary |
| [Materials](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/Materials.tsx) | UI-03, AUD-03/05/06/08 | список, поиск, стадии, демонстрационные подтверждения удаления, низкое место |
| [Recording](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/Recording.tsx) | UI-04, AUD-01…08 | явное demo-записывание/таймер/стоп/прослушивание/сохранение или discard свежего аудио |
| [Material](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/Material.tsx) | UI-05/06, UI-TR-01…05, TXT-01…11, TR-01…09 | сохраняемый для ревью A, 10 000 символов, stale B и Translation, свёрнутый RU блок, переход во Phrase |
| [Phrase](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/Phrase.tsx) | UI-07, VOC-01…07 | один контекстный перевод и добавление; редактирование доступно только через Dictionary |
| [Settings](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/Settings.tsx) | UI-12, SET-01…13 | два ограниченных отдельных фиктивных selector, неизвестные тарифы, фиксированные значения, приватность и контакт |
| [AISettings](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/AISettings.tsx) | UI-13, SET-09…12, REW-02 | утверждённый текст B, свёрнутые редактируемые промпты, отдельные editable параметры Б/перевода, локальные Save/Reset |
| [FirstLaunch](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/FirstLaunch.tsx) | UI-01, MODE-01, NET-01 | пустой Dictionary, новый ручной ввод, без входа, независимые режимы |
| [KeyConnection](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/KeyConnection.tsx) | UI-02, SEC-KEY, NET-01 | только вымышленный masked input/статусы, одноразовое demo disclosure, никакого provider запроса |
| [Confirmations](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/Confirmations.tsx) | UI-14, AUD-08, SEC-DATA-11 | точные границы аудио/материала/текстов/карточек/ключа и отдельный reset |
| [States](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/States.tsx) | UI-01…14 | нарисованные пустые состояния, offline, mic denial, loading/cancel, translation error/retry, stale/incomplete и storage failure + полный реестр |
| [FlowMap](../../artifacts/mockup-sandbox/src/components/mockups/english-lab-mvp/FlowMap.tsx) | MODE-01…06, AC-18…20 | независимые режимы, цепочка A → B → RU и все три сценария возобновления |

## Ключевые пути и ограничения

1. Стартовый режим — Dictionary; Materials и Learning доступны независимо и наравне. Settings отдельно.
2. Материал: запись (макетная) → A (единственный редактируемый транскрипт) → B (только чтение) → Translation · Russian (свёрнут при каждом открытии). Ошибка/правка сохраняет предыдущий результат как устаревший, не удаляет его.
3. Выделенная фраза → Phrase → один RU перевод → Add to Dictionary → исправление только в Dictionary.
4. Learning имеет фиксированную демонстрационную очередь из 10 уникальных EN/RU/example пар. Ответ скрыт до Show answer. Последняя оценка открывает итог; Continue запускает следующую очередь, Exit реально ведёт в Dictionary. Слова, добавленные в текущем demo-сеансе, не подмешиваются к открытой очереди.
5. **AC-18:** записать фрагмент → Dictionary → Learning/оценки → возврат в материал; аудио остаётся, A можно создать без повторной записи.
6. **AC-19:** запись и A → закрыть → старт в Dictionary → открыть материал и создать/исправить A/B из сохранённых данных.
7. **AC-20:** Learning → Materials, создать A/B и добавить слова → вернуться к той же карточке/позиции/оценкам; новые слова участвуют только в следующей сессии.

Fixed scope: interface EN, learning EN, native RU, B1 → B2, light only; нет auth, language/theme selectors, C1 mode, игровых метрик или режима переключения состояний внутри экранов. REW-02 хранится как утверждённый полный исходный текст; его строка B1→B2/C1 — общий текст инструкции из прототипного ТЗ, не активирует C1-продуктовую функцию.

## State coverage · review board `States`

Нарисованные панели: UI-01 пустой Dictionary; UI-02 no key; UI-03 пустые Materials; UI-04 mic permission denied; offline без запроса; request loading с cancel; Translation error с retry только Translation; stale B после правки A; incomplete result, не заменяющий прошлый B; storage error с сохранением прежнего результата.

Дополнительный реестр UI-01…14 покрывает decline disclosure, resume, неверный ключ/SecureStore failure, пустой поиск/мало места/аудио удалено, interruption/save failure, пустой A, retry/error/stale dependencies, модель недоступна/несовместимые параметры, duplicate phrase, invalid card, Learning empty/save error/restored side, partial completion/no next queue, unavailable rates/offline, unsupported A prompt и безопасные удаления. Все панели обозначены requirement ID; операции остаются демонстрационными.

## Design handoff

- **Направление:** «тихий учебный блокнот»; вертикальная edge-to-edge композиция, спокойные карточки, без технической AI-console эстетики.
- **Типографика:** Fraunces для заголовков/выражений, DM Sans для UI и чтения.
- **Палитра:** paper `#F5F8F3`, surface `#FFFEFA`, ink `#243B39`, muted `#647774`, evergreen `#315F53`, sage `#DCEBE1`, coral `#CF7862`, gold `#E5C27D`.
- **Ритм / touch:** шаги 8/12/16/20 px; интерактивные цели минимум 48 px; sticky нижняя навигация равных ширин; вертикальная прокрутка; responsive state board.
- **Движение:** короткие transform/opacity переходы, выключаются при `prefers-reduced-motion`.
- **Demo storage:** неключевые значения сохраняются только локально для интерактивного ревью в browser origin; Save означает запись демо-состояния, не настоящий SQLite/SecureStore.

### Проверить отдельно перед реализацией

- [ ] Согласовать визуальную систему и каждую группу экранов; требования остаются согласованными, макеты пока не утверждены.
- [ ] Проверить Android 360×800, 412×915, landscape, safe areas, IME, TalkBack, 200% размер шрифта, контраст и focus order.
- [ ] Подтвердить совместимость моделей/endpoint и актуальные тарифы. Пока модели вымышлены, тарифы unavailable; провайдерная доступность не проверялась.
- [ ] Отдельно испытать SQLite, SecureStore/Keystore, TLS, backup исключения, screenshot protection, аудио lifecycle и фактические AC.
- [ ] Перед первым запросом реализовать одноразовое согласие NET-01/SEC-DATA-06; отказ не блокирует локальные режимы.
- [ ] Получить визуальное одобрение владельца до интеграции в production app.

## Portable SVG

SVG доступны для импорта и дальнейшего редактирования:
[Dictionary](design-svg/dictionary.svg) ·
[Learning](design-svg/learning.svg) ·
[Materials](design-svg/materials.svg) ·
[Material](design-svg/material.svg) ·
[Settings](design-svg/settings.svg).

Это вручную собранные векторные эскизы репрезентативных экранов, не точные копии React-рендеров, не native layouts и не Figma-файл. Текстовые элементы, прямоугольники и пути остаются обычными редактируемыми SVG-векторами.
