# my-app — одностраничное бизнес-приложение (web, Android, Windows)

Одна страница под конкретную компанию. Персонализация — только через
`config/company.json`. Из этого файла собираются все три версии: сайт,
APK и установщик для Windows.

## Быстрый старт

```bash
cd my-app
npm install
npm run dev          # http://localhost:5173
npm test             # 43 теста: юнит, property-based, интеграционные
npm run lint
npm run build        # → dist/
```

## Три сборки

| Что | Команда | Результат | Куда отдаём |
| --- | --- | --- | --- |
| Демо | `npm run build:demo` | `dist-demo/` | GitHub Pages (CI) |
| Android | `npm run android:apk` | `app-debug.apk` | клиенту на телефон / Google Play |
| Windows | `npm run installer:win` | `<appId>-setup-<версия>.exe` | клиенту на ПК |

Установщик и APK без локальной установки инструментов собирает GitHub Actions.
Подробности: [docs/MOBILE.md](docs/MOBILE.md), [docs/DESKTOP.md](docs/DESKTOP.md),
[docs/DEMO.md](docs/DEMO.md). Первый пуш, Pages и секреты —
[docs/SETUP-GITHUB.md](docs/SETUP-GITHUB.md).

## Структура

```
.dsh/            инструкции и скиллы агента
.github/         CI: проверки, APK, установщик Windows, демо на Pages
android/         нативный проект Capacitor
config/          company.json — единственный источник данных компании
docs/            PROJECT, CONVENTIONS, STATE, DECISIONS, MOBILE, DESKTOP, DEMO
electron/        оболочка ПК-версии (main.cjs)
installer/       шаблон установщика Inno Setup
knowledge/       база знаний (не менять без подтверждения)
public/          логотип, фото техники
scripts/         генерация Android-конфига, сборка APK и установщика
src/             core/ (конфиг, цены, Telegram) + main.js + style.css
tests/           unit / integration / e2e
```

## Команды

| Команда | Что делает |
| --- | --- |
| `npm run dev` | Дев-сервер Vite |
| `npm run build` | Сборка сайта в `dist/` |
| `npm run build:demo` | Демо-сборка с плашкой и отключённой отправкой |
| `npm test` | Vitest: юнит + интеграция + property-based |
| `npm run test:e2e` | Playwright (нужны браузеры: `npx playwright install`) |
| `npm run lint` | ESLint |
| `npm run android:config` | Синхронизация `appId`/`appName`/версии в Android |
| `npm run android:sync` | build + `cap sync android` |
| `npm run android:apk` | Сборка debug APK |
| `npm run desktop:run` | Запуск ПК-версии локально |
| `npm run desktop:pack` | Electron-пакет в `release/win-unpacked/` |
| `npm run installer:win` | Установщик `.exe` (нужен Inno Setup 6) |

## Заметка про окружение

В песочнице DSH на Windows Vite падает с `spawn EPERM` (проверка сетевых дисков),
а npm-скрипты пакетов не могут запускать дочерние процессы. Поэтому:

- Vite запускается с `--configLoader native`, тесты — в пуле потоков;
- Electron ставится с `--ignore-scripts`, бинарник докачивается
  `node node_modules/electron/install.js` с `electron_config_cache` внутри проекта.

Вне песочницы это не мешает.
