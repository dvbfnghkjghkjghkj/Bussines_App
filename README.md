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

## Два шаблона

Один и тот же код обслуживает две схемы, выбор — поле `template` в `config/company.json`:

| `template` | Для кого | Блоки | Форма |
| --- | --- | --- | --- |
| `services` | барбершопы, салоны, мастера | услуги и цены по уровням мастеров | услуга, мастер, дата |
| `rental` | аренда спецтехники и оборудования | техника с тремя статусами, калькулятор с доставкой по зонам, панель владельца | техника, часы, адрес, зона |

Обе схемы описаны валидацией и тестами; образец аренды — `config/examples/rental.json`,
образец услуг — `config/examples/services.json`. Сейчас активен `rental`:
`config/company.json` — демо СТРОЙМАШ (Екатеринбург, 4 машины, доставка
5 000 / 9 000 / 14 000 ₽).

Расчёт в аренде: часы × ставка, но не меньше минимальной смены; доставка —
фиксированная цена зоны. Панель владельца открывается по `#owner`: там меняются
цена, минимальная смена и статус каждой машины. Правки хранятся в localStorage
браузера (ADR-0012) — чтобы их увидели клиенты, данные переносятся в конфиг.

Баннер и фото задаются конфигом: `features` — плашки преимуществ,
`machines[].photo` — путь к снимку. Источники и лицензии фото — `docs/CREDITS.md`.

Правки владельца видны клиентам, если заполнен блок `cloud` (Supabase):
таблица `machines`, вход владельца по e-mail, запись только для вошедших.
Инструкция — `docs/SUPABASE.md`, без ключей работает локальный режим на
`localStorage`.

## Структура

```
.dsh/            инструкции и скиллы агента
.github/         CI: проверки, APK, установщик Windows, демо на Pages
android/         нативный проект Capacitor
build/           icon.ico для exe и установщика (генерируется)
config/          company.json — единственный источник данных компании
config/examples/ пример конфига для шаблона «аренда техники»
docs/            PROJECT, CONVENTIONS, STATE, DECISIONS, MOBILE, DESKTOP, DEMO
electron/        оболочка ПК-версии (main.cjs)
installer/       шаблон установщика Inno Setup
knowledge/       база знаний (не менять без подтверждения)
public/          логотип, изображения
resources/       icon.png, splash.png для Android (генерируются)
scripts/         генерация иконок и Android-конфига, сборка APK и установщика
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
| `npm run icons` | Иконки и splash из `public/logo.svg` |
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
