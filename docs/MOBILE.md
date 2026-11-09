# MOBILE.md — Android-версия и сборка APK

## Идея в одном абзаце

Одна кодовая база: `src/` собирается Vite в статический `dist/`, а Capacitor
заворачивает этот `dist/` в нативный Android-проект (`android/`). Внутри APK
работает WebView, который грузит те же файлы с `https://localhost` — без
хостинга и без интернета. Данные компании, как и в вебе, берутся из
`config/company.json`; из того же файла генерируются имя приложения и package id.

```
src/ + config/company.json
        │  npm run build
        ▼
      dist/  ──────►  android/app/src/main/assets/public/
        │  npx cap sync android
        ▼
   android/  ──►  ./gradlew assembleDebug  ──►  app-debug.apk
```

## Что где лежит

| Путь | Назначение |
| --- | --- |
| `capacitor.config.json` | Генерируется из `config/company.json`, руками не правится |
| `android/` | Нативный проект Capacitor 8, коммитится в репозиторий |
| `android/app/build.gradle` | `applicationId`, `versionCode`, `versionName`, подпись release |
| `android/app/src/main/res/values/strings.xml` | `app_name` и прочие строки, синхронизируются скриптом |
| `scripts/gen-android-config.mjs` | Генерация конфига и синхронизация идентификаторов |
| `scripts/build-apk.mjs` | Локальная сборка через Gradle |

## Персонализация под клиента

Правится только `config/company.json`:

```json
"app": {
  "appId": "ru.ivanov.spectehnika",
  "appName": "OldBoy",
  "versionCode": 1,
  "versionName": "1.0.0"
}
```

Затем:

```bash
npm run android:config   # capacitor.config.json + strings.xml + build.gradle
npm run android:apk      # сборка debug APK
```

`appId` — только строчные латинские буквы, цифры, точки и `_`, минимум два
сегмента. После публикации менять `appId` нельзя: это другое приложение в
Google Play, обновление не встанет поверх старого.

`versionCode` увеличивается на каждый релиз, `versionName` — человекочитаемая
версия. Android не установит APK с тем же `versionCode` поверх установленного.

## Заявки в Telegram: без токена в APK

| Платформа | Что происходит |
| --- | --- |
| Web | Кнопка ведёт на `https://t.me/<ник>?text=<заявка>` — открывается чат компании с готовым текстом, клиент жмёт «Отправить» |
| APK | Кнопка открывает `tg://resolve?domain=<ник>&text=<заявка>` — сразу чат компании с заполненным текстом |

Токен бота в APK не кладём: он извлекается из бинарника за минуту, после чего
ботом можно спамить от имени компании. Ник берётся из `contacts.telegram`
(`@company` или `https://t.me/company` — оба варианта нормализуются).

Если Telegram не установлен или ссылка не открылась, страница предлагает
скопировать текст заявки в буфер обмена.

## Локальная сборка

Нужно: **JDK 21**, **Android SDK** (platform 36, build-tools 36), переменная
`ANDROID_HOME`. Android Studio ставит всё разом.

```bash
npm install
npm run android:config
npm run android:apk          # → android/app/build/outputs/apk/debug/app-debug.apk
```

Установка на подключённый телефон:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb logcat | findstr Capacitor   # Windows
```

Отладка WebView: откройте `chrome://inspect` в Chrome на компьютере, приложение
должно быть запущено на устройстве.

## Сборка в CI (рекомендуемый путь)

`.github/workflows/android-apk.yml` собирает APK без локальной установки
инструментов:

- запуск вручную (`workflow_dispatch`) или по тегу `v*`;
- Node 20, JDK 21, кэш Gradle;
- `npm run android:config` → `npm run build` → `npx cap sync android`;
- `./gradlew assembleDebug` → артефакт `app-debug-apk`;
- если заданы секреты подписи — дополнительно `assembleRelease` → `app-release-apk`.

Секреты репозитория для подписи:

| Секрет | Значение |
| --- | --- |
| `ANDROID_KEYSTORE_B64` | keystore в base64: `base64 -w0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | пароль хранилища |
| `ANDROID_KEY_ALIAS` | алиас ключа |
| `ANDROID_KEY_PASSWORD` | пароль ключа |

Создание keystore (один раз на клиента, файл хранить вне репозитория):

```bash
keytool -genkeypair -v -keystore release.keystore -alias company \
  -keyalg RSA -keysize 2048 -validity 10000
```

Потеря keystore = невозможность обновить приложение в Google Play. Храните
копию в менеджере секретов, а не в чате.

## Иконка и заставка

Источник правды один — `public/logo.svg`. Из него генерируются все размеры:

```bash
npm run icons                          # resources/*.png + build/icon.ico
npx @capacitor/assets generate --android
```

`scripts/gen-icons.mjs` (sharp) собирает `resources/icon.png` 1024×1024,
`icon-foreground.png` и `icon-background.png` для adaptive icon,
`splash.png` 2732×2732 в брендовом цвете `#0f766e`. PNG руками не правьте:
меняйте SVG и перегенерируйте. Вторая команда раскладывает результат по
`mipmap-*` и `drawable-*` в `android/` — 123 файла, они коммитятся.

Без этого остаётся стандартная иконка Capacitor — для тестового APK допустимо,
для клиента нет.

## Чек-лист перед передачей APK

- [ ] `app.appId` уникален и совпадает с договорённостью с клиентом.
- [ ] Название компании и контакты заполнены в `config/company.json`.
- [ ] `contacts.telegram` ведёт на реальный чат, заявка доходит.
- [ ] `versionCode` больше предыдущей сборки.
- [ ] APK ставится на чистое устройство и открывается без интернета.
- [ ] Форма проверена на телефоне: клавиатура не перекрывает поля.
- [ ] Нет `TELEGRAM_BOT_TOKEN` в APK: `unzip -p app-release.apk assets/public/*.js | grep -i token`.

## Частые проблемы

**`spawn EPERM` при `npm run dev`/`build`.** Vite на Windows проверяет сетевые
диски через `net use`, а песочница DSH запрещает дочерние процессы с pipe.
Скрипты уже запускают Vite с `--configLoader native` — это обходит проверку.
Вне песочницы флаг безвреден.

**`SDK location not found`.** Не задан `ANDROID_HOME` или нет
`android/local.properties` с `sdk.dir=...`. Файл не коммитится.

**`Gradle requires JVM 21`.** Установлена старая Java. Проверьте
`java -version` и `JAVA_HOME`.

**Страница в APK пустая.** Забыли `npm run build` перед `npx cap sync` —
в `assets/public` попал старый `dist` или его нет вовсе.

**Белый экран после обновления.** Кэш WebView: очистите данные приложения или
переустановите APK, затем проверьте консоль через `chrome://inspect`.
