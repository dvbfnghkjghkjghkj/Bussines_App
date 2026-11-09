#!/usr/bin/env node
/**
 * Локальная сборка debug-APK: ./gradlew assembleDebug.
 * Требует JDK 21 и Android SDK. В CI то же самое делает GitHub Actions,
 * поэтому локальная установка инструментов не обязательна.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidDir = path.join(root, 'android');

if (!existsSync(androidDir)) {
  console.error('Папка android/ не найдена. Сначала выполните: npx cap add android');
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const gradlew = isWindows ? 'gradlew.bat' : './gradlew';
const task = process.argv[2] ?? 'assembleDebug';

console.log(`Сборка APK: ${gradlew} ${task} (может занять несколько минут)`);

const result = spawnSync(gradlew, [task], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWindows,
});

if (result.error) {
  console.error(`Не удалось запустить Gradle: ${result.error.message}`);
  console.error('Проверьте JDK 21 (java -version) и ANDROID_HOME.');
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`Gradle завершился с кодом ${result.status}`);
  process.exit(result.status ?? 1);
}

const apk = path.join(
  androidDir,
  'app',
  'build',
  'outputs',
  'apk',
  'debug',
  'app-debug.apk',
);

console.log(existsSync(apk) ? `Готово: ${apk}` : 'Сборка прошла, но APK не найден — проверьте вывод Gradle.');
