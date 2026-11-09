# STATE.md — состояние проекта

> Живой документ. Читается агентом **перед** задачей и обновляется **после**.
> Формат дат: `ГГГГ-ММ-ДД`. Устаревшие пункты удаляй, а не копи в «Сделано».

Обновлено: 2026-11-09

## Сделано

- Каркас проекта: папки, docs, конфиг, скиллы агента (knowledge-review, feature-dev).
- Web-приложение: одна страница на Vite 8, данные из `config/company.json`,
  блоки «Техника», «Доставка», форма заявки с предварительной ценой.
- Логика в `src/core/`: валидация конфига, расчёт смены, ссылки Telegram.
- Тесты: 43 зелёных — юнит, property-based (fast-check) на цены, интеграционные
  на реальный `config/company.json`.
- Android: Capacitor 8, `android/` сгенерирован, `appId`/имя/версия
  синхронизируются скриптом `scripts/gen-android-config.mjs`.
- Подпись release APK через переменные окружения в `android/app/build.gradle`.
- Windows: Electron 45 (`electron/main.cjs`), конфиг electron-builder читает
  `config/company.json`; установщик Inno Setup по конвенциям прошлых проектов
  (per-user, русский мастер, ярлыки), генерация `setup.generated.iss`.
- Демо-режим: `npm run build:demo` → `dist-demo`, флаг `__DEMO__`, плашка,
  отключённая отправка заявок и скрытая ссылка Telegram.
- CI: `ci.yml` (lint + test + build), `android-apk.yml` (APK артефактом),
  `windows-installer.yml` (Electron + Inno Setup → `.exe`),
  `pages-demo.yml` (демо на GitHub Pages).
- Заявки из APK — deep link `tg://`, токен бота в клиентские сборки не попадает.
- Первый прогон CI на GitHub: `CI` — зелёный, `Windows Installer` — зелёный,
  собран установщик 109.7 МБ (артефакт `windows-installer`).
- `Android APK` упал на `npx cap sync`: Capacitor CLI 8 требует Node ≥ 22;
  `Demo` упал на `configure-pages`: Pages не был включён.
- Все workflow переведены на Node 22, в `package.json` добавлено
  `engines.node >= 22.12.0`.

## В работе

- —

## Осталось

- Заполнить реальные данные в `config/company.json` (название, контакты,
  Telegram-ник, цены, зоны доставки) — от них зависят имена APK и установщика.
- Завести первые файлы в `knowledge/` и прогнать «изучи knowledge».
- Иконка и splash: `resources/icon.png`, `npx @capacitor/assets generate --android`;
  иконка окна/установщика для ПК (`build/icon.ico`).
- Инициализировать git, запушить репозиторий, включить Pages
  (Settings → Pages → GitHub Actions).
- Прогнать в CI: APK, установщик Windows, деплой демо. Локально Electron-пакет
  собрать не удалось: сеть в песочнице не пускает к GitHub releases, откуда
  качается бинарник Electron, — первый запуск `windows-installer.yml` и станет
  проверкой конфигурации.
- Сгенерировать release keystore для APK и положить в secrets.
- E2E-тесты (Playwright): форма, демо-режим, переход в Telegram.
- Проверить демо на реальном телефоне и ПК-приложение на чистой Windows.

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

## Knowledge review

- Ещё не проводился.
