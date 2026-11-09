/**
 * Конфиг electron-builder. Имя, appId и версия берутся из config/company.json —
 * тот же источник, что у web и Android-сборок.
 */
const company = require('./config/company.json');

const appConfig = company.app ?? {};
const appId = String(appConfig.appId ?? 'ru.example.businessapp');
const productName = String(appConfig.appName ?? company.companyName ?? 'Business App');
const executableName = resolveExeName(appConfig, appId);

/** Имя exe: app.exeName, иначе последний сегмент appId. Логика дублирует build-installer.mjs. */
function resolveExeName(app, identifier) {
  const custom = String(app?.exeName ?? '').trim();
  if (/^[A-Za-z0-9._-]+$/.test(custom)) return custom;
  return identifier.split('.').pop() || 'app';
}

module.exports = {
  appId,
  productName,
  executableName,
  copyright: `© ${new Date().getFullYear()} ${company.companyName}`,
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: ['dist/**/*', 'electron/**/*', 'build/icon.ico', 'package.json', '!node_modules/**/*'],
  asar: true,
  compression: 'maximum',
  win: {
    target: [{ target: 'dir', arch: ['x64'] }],
    icon: 'build/icon.ico',
    artifactName: `${executableName}-${appConfig.versionName ?? '0.0.0'}-\${arch}.\${ext}`,
  },
};
