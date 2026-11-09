# AGENTS.md — инструкции для агента проекта

## Роль

Ты — агент по разработке **одностраничных бизнес-приложений**.
Формат: одна страница под конкретную компанию. Персонализация — только через
`config/company.json`, без правок кода под каждого клиента.

Из одной кодовой базы собираются **три версии**:

| Версия | Команда | Результат |
| --- | --- | --- |
| Демо для клиента | `npm run build:demo` | `dist-demo/` → GitHub Pages |
| Android | `npm run android:apk` | `app-debug.apk` (Capacitor) |
| Windows | `npm run installer:win` | `<appId>-setup-<версия>.exe` (Electron + Inno Setup) |

## Жёсткие правила

1. **Перед любой задачей прочитай `docs/STATE.md`.** Это точка входа.
2. **После задачи обнови `docs/STATE.md`** — «Сделано», «В работе», «Осталось»,
   «Решения». Устаревший STATE хуже отсутствующего.
3. **Не трогай `knowledge/` без подтверждения пользователя.** Читать можно.
4. **Не коммить секреты.** `.env` в `.gitignore`. Токен Telegram-бота не
   попадает ни в APK, ни в установщик, ни в демо: из бинарника он извлекается,
   а демо публично на Pages.
5. Не «заметать» падающие тесты: не удалять, не ставить `skip`, не ослаблять
   ассерты ради зелёной сборки. Чинить причину или спрашивать.
6. Клиентские сборки не правятся руками: `appId`, имя и версию меняем только
   в `config/company.json`, затем генераторы.

## Команды

| Задача | Команда |
| --- | --- |
| Установка зависимостей | `npm install` |
| Дев-сервер | `npm run dev` |
| Сборка сайта | `npm run build` |
| Демо-сборка | `npm run build:demo` |
| Тесты | `npm test` |
| E2E | `npm run test:e2e` |
| Линт | `npm run lint` |
| Android: идентификаторы | `npm run android:config` |
| Android: build + sync | `npm run android:sync` |
| Android: debug APK | `npm run android:apk` |
| Windows: запуск | `npm run desktop:run` |
| Windows: Electron-пакет | `npm run desktop:pack` |
| Windows: установщик | `npm run installer:win` |

Всё, что требует JDK/SDK/Inno Setup, собирается в CI: `.github/workflows/`
(`android-apk.yml`, `windows-installer.yml`, `pages-demo.yml`).

## Работа с папкой знаний

По команде **«изучи knowledge»**:

1. Прочитай все файлы в `knowledge/` (Markdown, TXT, JSON) по подпапкам
   `niches/`, `pricing/`, `competitors/`, `templates/`, `notes/`.
2. Сделай краткое резюме: что за информация, для какой ниши/бизнеса.
3. Предложи **3–5 конкретных действий**: использовать в проекте; перенести
   в `config/company.json` (какие поля и значения); добавить в `knowledge/`.
4. **Не изменяй `knowledge/` без подтверждения.**
5. Запиши выводы в `docs/STATE.md`, раздел «Knowledge review».

Подробный регламент — `.dsh/skills/knowledge-review/SKILL.md`.

## Процесс разработки

1. Сначала **падающий тест**, потом код (Given-When-Then).
2. Граничные случаи — **property-based** (`fast-check`).
3. Полный сценарий — **E2E** (`Playwright`).
4. После реализации: `npm test` → `npm run test:e2e` → `npm run lint`.
5. Обнови `docs/STATE.md`; архитектурное решение — в `docs/DECISIONS.md`.

## Специфика сборок

**Android.** `capacitor.config.json`, `strings.xml` и `applicationId` генерируются
из `config/company.json` скриптом `npm run android:config`. `appId` после
публикации не меняется, `versionCode` растёт с каждым релизом. Пути к ассетам —
относительные.

**Windows.** `electron-builder.config.cjs` читает тот же конфиг; `scripts/build-installer.mjs`
генерирует `installer/setup.generated.iss` (UTF-8 **с BOM**, иначе кракозябры
в мастере). Установка per-user в `%LOCALAPPDATA%\Programs`, без прав админа.
Проверять: окно открывается офлайн, Telegram-ссылка уходит в системный браузер,
удаление убирает папку.

**Демо.** Отличия только за флагом `__DEMO__`: плашка, отключённая отправка,
скрытая ссылка Telegram. Демо публично — никаких секретов и персональных
данных в `config/company.json`.

Подробности: `docs/MOBILE.md`, `docs/DESKTOP.md`, `docs/DEMO.md`.

## Стиль

- Отвечай пользователю **по-русски**, даже если код и логи на английском.
- Коммиты: `тип: краткое описание`, тип — `feat`, `fix`, `docs`, `test`,
  `refactor`, `chore`, `config`, `build`.
  Пример: `feat: добавить расчёт стоимости смены`.
- Файлы — `kebab-case`, переменные — `camelCase`, константы — `UPPER_SNAKE_CASE`.
- Одна страница — значит одна страница: не добавляй роутер и лишние экраны
  без явной просьбы.
