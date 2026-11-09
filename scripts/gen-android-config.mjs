#!/usr/bin/env node
/**
 * Генерирует capacitor.config.json и синхронизирует идентификаторы Android
 * из config/company.json. Один источник правды: имя приложения, package id,
 * версия — всё берётся из конфига, а не правится руками в android/.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'config', 'company.json');

if (!existsSync(configPath)) {
  console.error('Не найден config/company.json — запустите скрипт из папки my-app.');
  process.exit(1);
}

const company = JSON.parse(readFileSync(configPath, 'utf8'));
const app = company.app ?? {};
const appId = String(app.appId ?? '').trim();
const appName = String(app.appName ?? company.companyName ?? '').trim();
const versionCode = Number.isInteger(app.versionCode) ? app.versionCode : 1;
const versionName = String(app.versionName ?? '0.1.0').trim();

const APP_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

if (!APP_ID_PATTERN.test(appId)) {
  console.error(
    `app.appId в config/company.json невалиден: "${appId}".\n` +
      'Нужен идентификатор вида ru.company.app — только строчные латинские буквы, цифры, точки и _.',
  );
  process.exit(1);
}

if (!appName) {
  console.error('app.appName в config/company.json пуст — Android-приложению нужно имя.');
  process.exit(1);
}

const capacitorConfig = {
  appId,
  appName,
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

const configOut = path.join(root, 'capacitor.config.json');
writeFileSync(configOut, `${JSON.stringify(capacitorConfig, null, 2)}\n`, 'utf8');
console.log(`capacitor.config.json: appId=${appId}, appName="${appName}"`);

// Синхронизация уже сгенерированного android/ — если проекта ещё нет, пропускаем.
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
if (existsSync(gradlePath)) {
  const before = readFileSync(gradlePath, 'utf8');
  let after = before
    .replace(/namespace\s+"[^"]*"/, `namespace "${appId}"`)
    .replace(/applicationId\s+"[^"]*"/, `applicationId "${appId}"`)
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

  if (after !== before) {
    writeFileSync(gradlePath, after, 'utf8');
    console.log(`android/app/build.gradle: applicationId=${appId}, versionCode=${versionCode}, versionName=${versionName}`);
  } else {
    console.log('android/app/build.gradle: изменений нет');
  }
} else {
  console.log('android/: проект ещё не создан (npx cap add android) — шаг пропущен');
}

const stringsPath = path.join(root, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
if (existsSync(stringsPath)) {
  const before = readFileSync(stringsPath, 'utf8');
  let after = before
    .replace(/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">${escapeXml(appName)}</string>`)
    .replace(
      /<string name="title_activity_main">[^<]*<\/string>/,
      `<string name="title_activity_main">${escapeXml(appName)}</string>`,
    )
    .replace(/<string name="package_name">[^<]*<\/string>/, `<string name="package_name">${appId}</string>`)
    .replace(/<string name="custom_url_scheme">[^<]*<\/string>/, `<string name="custom_url_scheme">${appId}</string>`);

  if (after !== before) {
    writeFileSync(stringsPath, after, 'utf8');
    console.log(`strings.xml: app_name="${appName}"`);
  }
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
