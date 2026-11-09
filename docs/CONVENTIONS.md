# CONVENTIONS.md — договорённости проекта

## Структура папок

```
my-app/
├── .dsh/              # инструкции и скиллы агента
├── .github/workflows/ # CI: проверки, APK, установщик, демо
├── android/           # нативный проект Capacitor (коммитится)
├── config/            # company.json — персонализация
├── docs/              # PROJECT, CONVENTIONS, STATE, DECISIONS, MOBILE, DESKTOP, DEMO
├── electron/          # оболочка ПК-версии
├── installer/         # шаблон Inno Setup
├── knowledge/         # база знаний (только чтение без подтверждения)
├── public/            # логотип, фотографии техники
├── scripts/           # генерация Android-конфига, сборка APK и установщика
├── src/
│   ├── core/          # чистая логика: конфиг, цены, Telegram — без DOM
│   ├── main.js        # точка входа, рендер страницы
│   └── style.css
└── tests/
    ├── unit/          # быстрые проверки функций
    ├── integration/   # связки модулей, реальный config/company.json
    └── e2e/           # сквозной сценарий (Playwright)
```

## Нейминг

| Сущность | Стиль | Пример |
| --- | --- | --- |
| Файлы и папки | `kebab-case` | `price-calculator.js`, `company-card.js` |
| Переменные и функции | `camelCase` | `calcShiftPrice`, `companyName` |
| Константы | `UPPER_SNAKE_CASE` | `MAX_SHIFT_HOURS`, `DEFAULT_MIN_SHIFT_HOURS` |
| CSS-классы | `kebab-case` | `.machine-card`, `.price-range` |
| Ключи в JSON | `camelCase` | `ratePerHour`, `minShiftHours` |
| Тесты | `<модуль>.test.js` | `price-calculator.test.js` |
| Android `appId` | `ru.company.app` | `ru.ivanov.spectehnika` |
| Electron main | `main.cjs` (CommonJS) | `electron/main.cjs` |

Правила: имена — по-английски, тексты для пользователя — по-русски; никаких
транслитераций вроде `cenaZaChas`; булевы — с префиксом `is`/`has`/`can`.

## Сборки и генерируемые файлы

- `capacitor.config.json`, `android/app/src/main/res/values/strings.xml`,
  поля `appId`/`versionCode` в `android/app/build.gradle` — **генерируются**
  из `config/company.json` скриптом `npm run android:config`.
- `installer/setup.generated.iss` — генерируется `scripts/build-installer.mjs`.
- `release/`, `installer/output/`, `dist/`, `dist-demo/` — артефакты, не коммитятся.
- `android/` — коммитится: там манифест, иконки, подпись release.
- `electron/` — коммитится: это код приложения, а не артефакт.

## Ветки

- `main` — всегда рабочая и зелёная; пуш в `main` обновляет демо на Pages.
- Рабочие ветки от `main`: `feat/<кратко>`, `fix/<кратко>`, `docs/<кратко>`,
  `chore/<кратко>`. Пример: `feat/shift-price-calculator`.
- Одна ветка — одна задача. Мёржим через PR, даже если работаешь один.
- Долгие ветки перебазируем на `main`, а не сливаем `main` в ветку.

## Коммиты

Формат: `тип: краткое описание` (императив, строчные, без точки в конце).

Типы: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `config`, `build`.

Примеры:

```
feat: добавить расчёт стоимости смены
fix: исправить округление минимальной смены
docs: обновить STATE после интеграции Telegram
test: покрыть property-тестами расчёт цены
config: заполнить контакты и зоны доставки
build: собирать установщик Windows в CI
```

## Код

- Модули — ES-модули, без глобальных переменных; Electron main — `.cjs`.
- Данные компании не хардкодим: берём из `config/company.json`.
- `src/core/` не знает про DOM — так логика тестируется без браузера и
  переиспользуется во всех трёх сборках.
- Пути к ассетам — относительные (`./logo.svg`, а не `/logo.svg`): в APK и
  в установленном приложении страница грузится из файла.
- Демо-режим не ломает продакшен: отличия только за флагом `__DEMO__`.
- Ошибки не глотаем: логируем и показываем пользователю понятный текст.
- Функции — до ~40 строк, ранний возврат вместо вложенных условий.
- Перед PR: `npm test`, `npm run lint`, `npm run build`.
