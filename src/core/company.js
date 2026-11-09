import rawConfig from '../../config/company.json';

/**
 * Единственный источник данных компании.
 * Конфиг импортируется статически, а не через fetch: в APK (WebView)
 * файл лежит в assets, и запрос по относительному пути работает не везде.
 */
export const company = rawConfig;

const APP_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

/**
 * Проверяет конфиг компании. Возвращает список ошибок (пустой — всё в порядке).
 * Вызывается и в браузере, и в CI, чтобы битый конфиг не доехал до клиента.
 */
export function validateCompany(config = rawConfig) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return ['config/company.json: файл пуст или это не объект'];
  }

  if (!isNonEmptyString(config.companyName)) {
    errors.push('companyName: обязательное непустое поле');
  }

  if (!config.contacts || typeof config.contacts !== 'object') {
    errors.push('contacts: обязательный объект');
  } else if (!isNonEmptyString(config.contacts.phone)) {
    errors.push('contacts.phone: обязательный непустой телефон');
  }

  if (!Array.isArray(config.machines)) {
    errors.push('machines: обязательный массив');
  } else if (config.machines.length === 0) {
    errors.push('machines: нужна хотя бы одна единица техники');
  } else {
    config.machines.forEach((machine, index) => {
      const where = `machines[${index}]`;
      if (!isNonEmptyString(machine?.id)) errors.push(`${where}.id: обязательное поле`);
      if (!isNonEmptyString(machine?.name)) errors.push(`${where}.name: обязательное поле`);
      if (!isFiniteNumber(machine?.ratePerHour) || machine.ratePerHour < 0) {
        errors.push(`${where}.ratePerHour: число ≥ 0`);
      }
      if (!isFiniteNumber(machine?.minShiftHours) || machine.minShiftHours <= 0) {
        errors.push(`${where}.minShiftHours: число > 0`);
      }
    });
  }

  if (!Array.isArray(config.deliveryZones)) {
    errors.push('deliveryZones: обязательный массив (может быть пустым)');
  }

  if (config.app) {
    if (!isNonEmptyString(config.app.appId) || !APP_ID_PATTERN.test(config.app.appId)) {
      errors.push('app.appId: нужен идентификатор вида ru.company.app в нижнем регистре');
    }
    if (!isNonEmptyString(config.app.appName)) {
      errors.push('app.appName: обязательное непустое название приложения');
    }
  }

  return errors;
}

/** Отдаёт конфиг и бросает ошибку, если он невалиден. */
export function getCompany(config = rawConfig) {
  const errors = validateCompany(config);
  if (errors.length > 0) {
    throw new Error(`config/company.json невалиден:\n- ${errors.join('\n- ')}`);
  }
  return config;
}

/** Ищет машину по id. */
export function findMachine(id, config = rawConfig) {
  return config.machines.find((machine) => machine.id === id) ?? null;
}

/** Телеграм-ник без @ и без ссылки t.me. */
export function telegramUsername(config = rawConfig) {
  const raw = config.contacts?.telegram ?? '';
  return String(raw)
    .trim()
    .replace(/^https?:\/\/t\.me\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
