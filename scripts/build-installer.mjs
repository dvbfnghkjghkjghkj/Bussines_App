#!/usr/bin/env node
/**
 * Собирает установщик Windows из готового Electron-приложения.
 *
 * Шаги: config/company.json → installer/setup.generated.iss → ISCC → output/*.exe
 * Требует: собранный release/win-unpacked (npm run desktop:pack) и Inno Setup 6.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const company = JSON.parse(readFileSync(path.join(root, 'config', 'company.json'), 'utf8'));
const app = company.app ?? {};

const appId = String(app.appId ?? '').trim();
const appName = String(app.appName ?? company.companyName ?? '').trim();
const versionName = String(app.versionName ?? '0.1.0').trim();
const exeName = `${resolveExeName(app, appId)}.exe`;

const payloadDir = path.join(root, 'release', 'win-unpacked');
if (!existsSync(path.join(payloadDir, exeName))) {
  console.error(
    `Не найден собранный Electron-пакет: ${payloadDir}\\${exeName}\n` +
      'Сначала выполните: npm run desktop:pack',
  );
  process.exit(1);
}

const versionInfo = toVersionInfo(versionName);
const templatePath = path.join(root, 'installer', 'setup.iss.template');
const template = readFileSync(templatePath, 'utf8');

const generated = template
  .replaceAll('{{APP_ID}}', appId)
  .replaceAll('{{APP_NAME}}', appName.replaceAll('"', "'"))
  .replaceAll('{{VERSION}}', versionName)
  .replaceAll('{{VERSION_INFO}}', versionInfo)
  .replaceAll('{{EXE_NAME}}', exeName)
  .replaceAll('{{PAYLOAD_DIR}}', payloadDir);

const generatedPath = path.join(root, 'installer', 'setup.generated.iss');
// Inno Setup 6 читает UTF-8 только с BOM — иначе русский текст превращается в кракозябры.
writeFileSync(generatedPath, `\uFEFF${generated}`, 'utf8');
console.log(`Сгенерирован ${path.relative(root, generatedPath)}`);

const iscc = findInnoSetup();
if (!iscc) {
  console.error(
    'Inno Setup 6 не найден (ISCC.exe).\n' +
      'Установите: https://jrsoftware.org/isdl.php — или соберите установщик в CI:\n' +
      '  .github/workflows/windows-installer.yml',
  );
  process.exit(1);
}

console.log(`Компилирую установщик: ${iscc}`);
const result = spawnSync(iscc, [generatedPath], { cwd: path.join(root, 'installer'), stdio: 'inherit' });

if (result.error) {
  console.error(`Не удалось запустить ISCC: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`ISCC завершился с кодом ${result.status}`);
  process.exit(result.status ?? 1);
}

const setupName = `${appId}-setup-${versionName}.exe`;
console.log(`Готово: installer\\output\\${setupName}`);

/**
 * Имя exe берётся из app.exeName (латиница), иначе — последний сегмент appId.
 * Та же логика в electron-builder.config.cjs: расхождение сломает поиск файла.
 */
function resolveExeName(appConfig, appIdentifier) {
  const custom = String(appConfig?.exeName ?? '').trim();
  if (/^[A-Za-z0-9._-]+$/.test(custom)) return custom;
  return appIdentifier.split('.').pop() || 'app';
}

function toVersionInfo(version) {
  const parts = String(version).split(/[.-]/).filter((part) => /^\d+$/.test(part));
  while (parts.length < 4) parts.push('0');
  return parts.slice(0, 4).join('.');
}

function findInnoSetup() {
  const candidates = [
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null;
}
