# DESKTOP.md — ПК-версия (Windows) и установщик

## Что получается

Одна и та же страница в трёх обёртках:

| Цель | Что это | Файл |
| --- | --- | --- |
| Web / демо | статический сайт на GitHub Pages | `dist-demo/` |
| Android | APK в WebView | `app-debug.apk` |
| Windows | приложение Electron + установщик Inno Setup | `*-setup-*.exe` |

ПК-версия — это Electron: отдельное окно без браузерной обвязки, работает офлайн,
данные те же (`config/company.json`). Установщик — Inno Setup 6, по тем же
правилам, что в остальных проектах: установка без прав администратора
в `%LOCALAPPDATA%\Programs\<Название>`, русский мастер, ярлык в «Пуск» и
опционально на рабочем столе.

```
src/ + config/company.json
        │ npm run build:desktop
        ▼
      dist/ ──► electron/ ──► electron-builder --win dir ──► release/win-unpacked/
                                                                   │
                                            Inno Setup (ISCC)  ◄───┘
                                                   ▼
                                    installer/output/<appId>-setup-<версия>.exe
```

## Команды

| Команда | Что делает |
| --- | --- |
| `npm run desktop:run` | Собрать и запустить приложение локально |
| `npm run desktop:pack` | `dist` + Electron → `release/win-unpacked/` |
| `npm run installer:win` | `desktop:pack` + Inno Setup → `installer/output/*.exe` |

Требуется: Node 20+, для установщика — Inno Setup 6 (`ISCC.exe`).
Локальная сборка установщика опциональна: в CI он собирается на `windows-latest`
(`.github/workflows/windows-installer.yml`), Inno Setup ставится через Chocolatey.

## Персонализация

Ничего не правится руками: `electron-builder.config.cjs` читает
`config/company.json` и подставляет

- `app.appId` → `appId` приложения и имя exe (последний сегмент: `businessapp.exe`);
- `app.appName` → `productName`, заголовок окна, имя папки установки;
- `app.versionName` → версия установщика и `VersionInfoVersion`.

`scripts/build-installer.mjs` генерирует `installer/setup.generated.iss`
из шаблона и вызывает ISCC. Сгенерированный файл в репозиторий не попадает.

## Иконка

`build/icon.ico` собирается из того же логотипа, что Android и веб:

```bash
npm run icons        # build/icon.ico, 7 кадров 16–256 px
```

Иконка попадает в три места: сам exe (`win.icon` в конфиге electron-builder),
ярлыки «Пуск»/рабочий стол (наследуются от exe) и установщик
(`SetupIconFile` в `setup.iss.template`). ICO собирается скриптом вручную —
контейнер с PNG-кадрами, который понимает Windows Vista и новее, без
внешних утилит.

## Что умеет окно

- Загружает `dist/index.html` через `file://` — без локального сервера.
- Внешние ссылки (`https://t.me/...`, `tg://...`, `tel:`) открывает системным
  браузером, а не внутри приложения.
- Без меню и без доступа к Node из страницы (`nodeIntegration: false`,
  `contextIsolation: true`, `sandbox: true`).
- Размер: `win-unpacked` ~220–260 МБ, установщик ~85–110 МБ (LZMA2).

## Подпись и SmartScreen

Без подписи кода Windows покажет «Неизвестный издатель» при запуске установщика.
Варианты:

- тестовая передача клиенту — предупредить заранее, что это нормально;
- сертификат подписи кода (платный, десятки тысяч рублей в год) — вне бюджета
  проекта, поэтому по умолчанию не покупаем;
- в CI подпись отключена явно (`CSC_IDENTITY_AUTO_DISCOVERY=false`), чтобы
  сборка не искала сертификат.

## Сборка установщика в CI

Workflow `windows-installer.yml` запускается вручную или по тегу `v*`:

1. `npm install`, `npm test`, `npm run lint`;
2. `npm run desktop:pack` → `release/win-unpacked`;
3. `choco install innosetup -y`;
4. `node scripts/build-installer.mjs`;
5. артефакт `windows-installer` — готовый `.exe`.

## Частые проблемы

**`Не найден собранный Electron-пакет`.** Не выполнен `npm run desktop:pack`.

**`Inno Setup 6 не найден`.** Поставьте с jrsoftware.org или соберите в CI.

**Кракозябры в мастере установки.** `setup.generated.iss` должен быть в UTF-8
с BOM — скрипт пишет BOM сам, руками файл не пересохраняйте.

**Приложение открывает пустое окно.** Проверьте, что `dist/index.html`
существует и пути в нём относительные (`./assets/...`).

**Антивирус ругается на неподписанный exe.** Ожидаемо для сборки без
сертификата; исключение добавляется на стороне клиента.

## Чек-лист перед передачей

- [ ] `app.appName` и `app.appId` соответствуют клиенту.
- [ ] Установщик ставится без прав администратора.
- [ ] Ярлык в «Пуск» запускает приложение, окно открывается офлайн.
- [ ] Кнопка Telegram открывает системный браузер/Telegram, а не белое окно.
- [ ] Удаление через «Программы и компоненты» убирает папку целиком.
- [ ] Версия в имени файла совпадает с `app.versionName`.
