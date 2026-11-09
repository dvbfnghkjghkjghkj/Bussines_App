/**
 * Конфиг electron-builder. Имя, appId и версия берутся из config/company.json —
 * тот же источник, что у web и Android-сборок.
 */
const company = require('./config/company.json');

const appConfig = company.app ?? {};
const appId = String(appConfig.appId ?? 'ru.example.businessapp');
const productName = String(appConfig.appName ?? company.companyName ?? 'Business App');
const executableName = appId.split('.').pop() || 'app';

module.exports = {
  appId,
  productName,
  executableName,
  copyright: `© ${new Date().getFullYear()} ${company.companyName}`,
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: ['dist/**/*', 'electron/**/*', 'package.json', '!node_modules/**/*'],
  asar: true,
  compression: 'maximum',
  win: {
    target: [{ target: 'dir', arch: ['x64'] }],
    artifactName: `${executableName}-${appConfig.versionName ?? '0.0.0'}-\${arch}.\${ext}`,
  },
};
