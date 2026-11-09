# SETUP-GITHUB.md — первый пуш и запуск сборок

Инструкция на один раз: репозиторий, Pages, секреты, проверка.

## 1. Создать репозиторий

На GitHub: **New repository** → имя любое (`my-app`, `business-app`) →
**Private** → без README, без .gitignore, без лицензии.

Репозиторий лучше приватный: в `config/company.json` будут реальные контакты.

## 2. Первый пуш

Из папки `my-app`:

```bash
git init -b main
git add .
git commit -m "feat: каркас приложения с тремя сборками"
git remote add origin https://github.com/<аккаунт>/<репозиторий>.git
git push -u origin main
```

Если git просит логин — используйте Personal Access Token вместо пароля
(GitHub → Settings → Developer settings → Tokens (classic) → `repo`).

## 3. Включить демо на Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions.**

Больше ничего не нужно: workflow `Demo (GitHub Pages)` сам соберёт `dist-demo`
и опубликует. Адрес будет вида
`https://<аккаунт>.github.io/<репозиторий>/`.

Первый деплой — после пуша в `main` (или вручную: Actions → Demo → Run workflow).
Если открывается 404 — подождите минуту, деплой идёт отдельным job.

## 4. Секреты для подписи APK (необязательно)

Без них соберётся только debug APK — для тестовой передачи хватает.
Для release создайте keystore один раз:

```bash
keytool -genkeypair -v -keystore release.keystore -alias company \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.keystore > keystore.b64
```

**Settings → Secrets and variables → Actions → New repository secret:**

| Секрет | Значение |
| --- | --- |
| `ANDROID_KEYSTORE_B64` | содержимое `keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | пароль хранилища |
| `ANDROID_KEY_ALIAS` | `company` |
| `ANDROID_KEY_PASSWORD` | пароль ключа |

Сам `release.keystore` в репозиторий не кладите — он в `.gitignore`.
Потеря keystore = невозможность обновить приложение в Google Play.

## 5. Запустить сборки

Actions → выбрать workflow → **Run workflow**:

| Workflow | Что даёт | Требует |
| --- | --- | --- |
| `Windows Installer` | `windows-installer` → `*.exe` | — |
| `Android APK` | `app-debug-apk` → `app-debug.apk` | — |
| `Android APK` (release) | `app-release-apk` | 4 секрета из шага 4 |
| `Demo (GitHub Pages)` | опубликованный сайт | Pages включён |

Артефакты Actions хранятся 90 дней — скачайте и передайте клиенту.

## 6. Релиз тегом

```bash
git tag v1.0.0
git push --tags
```

Тег `v*` запускает сборку APK и установщика Windows. Перед этим поднимите
`app.versionName` и `app.versionCode` в `config/company.json` — версия попадёт
в имя файла и в манифест.

## Частые проблемы

**`Get Pages site failed. Please verify that the repository has Pages enabled`.**
Pages не включён. Settings → Pages → Build and deployment → Source:
**GitHub Actions**. Одна кнопка, после неё деплой проходит.

**`The Capacitor CLI requires NodeJS >=22.0.0`.** В workflow стоит слишком
старый Node. Нужен 22.12+ (требования Vite 8, Vitest 5, Electron 45,
Capacitor CLI 8); в CI это `node-version: 22`, локально проверяется
`node -v`.

**`refusing to merge unrelated histories`.** Репозиторий создан с README —
создайте пустой или выполните `git pull --allow-unrelated-histories`.

**Демо 404 после деплоя.** Pages не включён или деплой ещё идёт.
Проверьте: Actions → Pages job → `deploy`.

**Сборка APK падает на `chmod`.** Файл `gradlew` попал в репозиторий с
CRLF; в `.gitattributes` он помечен как `eol=lf` — сделайте
`git add --renormalize .` и закоммитьте.

**Установщик не находит Electron.** В CI он скачивается автоматически;
локально нужен `node node_modules/electron/install.js` (см. README).

**Actions не запускаются на пуше.** Для `android-apk` и `windows-installer`
триггер — только ручной запуск или тег `v*`, обычный пуш их не запускает.
