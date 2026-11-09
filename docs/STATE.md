# STATE.md — состояние проекта

> Живой документ. Читается агентом **перед** задачей и обновляется **после**.
> Формат дат: `ГГГГ-ММ-ДД`. Устаревшие пункты удаляй, а не копи в «Сделано».

Обновлено: 2026-11-09

## Сделано

- Каркас проекта: папки, docs, конфиг, скиллы агента (knowledge-review, feature-dev).
- Web-приложение: одна страница на Vite 8, данные из `config/company.json`,
  блоки «Услуги и цены», «Как найти», форма записи с ценой по уровню мастера.
- Логика в `src/core/`: валидация конфига, цены по уровням мастеров
  (диапазон на карточке, точная цена в форме), ссылки Telegram.
- Тесты: 49 зелёных — юнит, property-based (fast-check) на диапазон цен,
  интеграционные на реальный `config/company.json`.
- Android: Capacitor 8, `android/` сгенерирован, `appId`/имя/версия
  синхронизируются скриптом `scripts/gen-android-config.mjs`,
  `MainActivity.java` переезжает в пакет нового `appId`.
- Подпись release APK через переменные окружения в `android/app/build.gradle`.
- Windows: Electron 45 (`electron/main.cjs`), конфиг electron-builder читает
  `config/company.json`; имя exe — `app.exeName` («OldBoy.exe»), установщик
  Inno Setup по конвенциям прошлых проектов (per-user, русский мастер, ярлыки).
- Демо-режим: `npm run build:demo` → `dist-demo`, флаг `__DEMO__`, плашка,
  отключённая отправка заявок и скрытая ссылка Telegram.
- CI: `ci.yml` (lint + test + build), `android-apk.yml` (APK артефактом),
  `windows-installer.yml` (Electron + Inno Setup → `.exe`),
  `pages-demo.yml` (демо на GitHub Pages).
- Заявки из APK — deep link `tg://`, токен бота в клиентские сборки не попадает.
- Первый полностью зелёный прогон на GitHub: `CI` ✅, `Windows Installer` ✅
  (установщик 109.7 МБ), `Android APK` ✅ (debug APK 3.6 МБ),
  `Demo (GitHub Pages)` ✅ — сайт на
  https://dvbfnghkjghkjghkj.github.io/Bussines_App/
- Демо проверено в браузере: данные из конфига подставляются, плашка на месте,
  отправка отключена, ссылка Telegram скрыта, логотип загружается.
- Инцидент GitHub 18:14–18:48 UTC ронял запуски с `Internal server error`
  (0 job'ов, пустые логи); после восстановления платформы деплой прошёл.
- Pages включён через API (`build_type: workflow`), временный токен после
  настройки удалён.
- Иконки и splash: `scripts/gen-icons.mjs` (sharp) собирает `resources/*.png`
  и `build/icon.ico` из `public/logo.svg`; Android получил 123 ресурса через
  `@capacitor/assets`, иконка подключена к exe и установщику
  (`SetupIconFile`, `win.icon`).
- Данные клиента перенесены из карточки Яндекс.Карт: OldBoy, барбершоп,
  Тверь, Волоколамский просп., 25, корп. 1 (вход в цоколь справа от
  бильярдной «МАГНАТ»), +7 (910) 930-55-55, Пн и Ср–Вс 10:00–21:00,
  Вт — выходной, Telegram `@Cuba691`, 19 услуг, три уровня мастеров,
  акция −20 % на день рождения.
- Шаблон переориентирован с аренды техники на сферу услуг (ADR-0009):
  `services[]` + `levels[]` вместо `machines[]` и `deliveryZones[]`,
  блок «Доставка» заменён на «Как найти».
- `app.appId` = `ru.oldboy.barbershop`, `app.exeName` = `OldBoy`;
  генератор Android переносит Java-пакет (ADR-0010).

## В работе

- —

## Осталось

- Сгенерировать release keystore для APK и положить в secrets (сейчас APK
  debug-подписан, для клиента это временно допустимо).
- E2E-тесты (Playwright): форма записи, демо-режим, переход в Telegram.
- Проверить демо на реальном телефоне и ПК-приложение на чистой Windows.
- Завести первые файлы в `knowledge/` и прогнать «изучи knowledge».
- Пересобрать артефакты в CI после смены данных и `appId`: APK, установщик,
  демо (имена файлов изменились на `OldBoy.exe` / `ru.oldboy.barbershop-setup-*`).
- Решить судьбу публичности репозитория: сейчас он открыт, а в конфиге лежат
  реальные телефон и адрес клиента.

## Решения

- Capacitor вместо TWA и нативного Kotlin — один код на web и APK (ADR-0002).
- Заявки без токена: deep link в APK, share-ссылка в вебе (ADR-0003).
- APK собирается в CI, локальная установка JDK/SDK не обязательна (ADR-0004).
- Vite с `--configLoader native`, тесты в пуле потоков: обход `spawn EPERM`
  в песочнице Windows (ADR-0005).
- ПК-версия — Electron + Inno Setup, конвенции установщика как в прошлых
  проектах (ADR-0006).
- Демо — отдельная сборка с флагом `__DEMO__` и публикация на GitHub Pages
  из CI (ADR-0007).
- Electron ставится с `--ignore-scripts`, бинарник качается в кэш проекта
  из-за ограничений песочницы (ADR-0008).
- Модель услуг вместо аренды техники: цена зависит от уровня мастера,
  доставки и смен нет (ADR-0009).
- Имя exe — из `app.exeName`, Java-пакет Android переезжает при смене
  `appId` (ADR-0010).

## Knowledge review

- Ещё не проводился.
