import rawConfig from '../../config/company.json';

/**
 * Единственный источник данных компании.
 * Конфиг импортируется статически, а не через fetch: в APK (WebView)
 * файл лежит в assets, и запрос по относительному пути работает не везде.
 */
export const company = rawConfig;

export const APP_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

/** Тип шаблона: сфера услуг или аренда техники. */
export const TEMPLATES = ['services', 'rental'];

const TELEGRAM_HOSTS = ['t.me', 'telegram.me', 'telegram.dog'];
const MACHINE_STATUSES = ['available', 'busy'];

/** Тип шаблона из конфига; неизвестное значение считается «услуги». */
export function templateOf(config = rawConfig) {
  const value = String(config?.template ?? 'services').trim();
  return TEMPLATES.includes(value) ? value : 'services';
}

/**
 * Проверяет конфиг компании. Возвращает список ошибок (пустой — всё в порядке).
 * Вызывается и в браузере, и в CI, чтобы битый конфиг не доехал до клиента.
 */
export function validateCompany(config = rawConfig) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return ['config/company.json: файл пуст или это не объект'];
  }

  if (config.template !== undefined && !TEMPLATES.includes(config.template)) {
    errors.push(`template: допустимо ${TEMPLATES.map((name) => `«${name}»`).join(' или ')}`);
  }

  if (!isNonEmptyString(config.companyName)) {
    errors.push('companyName: обязательное непустое поле');
  }

  if (!config.contacts || typeof config.contacts !== 'object') {
    errors.push('contacts: обязательный объект');
  } else if (!isNonEmptyString(config.contacts.phone)) {
    errors.push('contacts.phone: обязательный непустой телефон');
  } else if (!isNonEmptyString(config.contacts.address)) {
    errors.push('contacts.address: обязательный адрес — по нему клиент едет');
  }

  if (templateOf(config) === 'services') {
    validateServices(config, errors);
  } else {
    validateRental(config, errors);
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

function validateServices(config, errors) {
  if (!Array.isArray(config.levels) || config.levels.length === 0) {
    errors.push('levels: нужен хотя бы один уровень мастера');
  } else {
    config.levels.forEach((level, index) => {
      const where = `levels[${index}]`;
      if (!isNonEmptyString(level?.id)) errors.push(`${where}.id: обязательное поле`);
      if (!isNonEmptyString(level?.name)) errors.push(`${where}.name: обязательное поле`);
    });
  }

  if (!Array.isArray(config.services) || config.services.length === 0) {
    errors.push('services: нужна хотя бы одна услуга');
    return;
  }

  const seen = new Set();
  config.services.forEach((service, index) => {
    const where = `services[${index}]`;
    const label = isNonEmptyString(service?.name) ? service.name : `№${index + 1}`;

    if (!isNonEmptyString(service?.id)) errors.push(`${where}.id: обязательное поле`);
    if (!isNonEmptyString(service?.name)) errors.push(`${where}.name: обязательное поле`);
    if (isNonEmptyString(service?.id)) {
      if (seen.has(service.id)) errors.push(`${where}.id: повторяется («${service.id}»)`);
      seen.add(service.id);
    }

    const prices = service?.prices ?? {};
    for (const [levelId, value] of Object.entries(prices)) {
      if (!isFiniteNumber(value) || value < 0) {
        errors.push(`${where}.prices.${levelId}: цена должна быть числом ≥ 0`);
      }
    }

    const hasBase = isFiniteNumber(service?.price) && service.price >= 0;
    if (Object.keys(prices).length === 0 && !hasBase) {
      errors.push(`${where} («${label}»): не задана ни одна цена`);
    }

    if (service?.duration !== undefined) {
      if (!isFiniteNumber(service.duration) || service.duration <= 0) {
        errors.push(`${where}.duration: длительность в минутах должна быть > 0`);
      }
    }
  });
}

function validateRental(config, errors) {
  if (!Array.isArray(config.machines) || config.machines.length === 0) {
    errors.push('machines: нужна хотя бы одна единица техники');
    return;
  }

  const seen = new Set();
  config.machines.forEach((machine, index) => {
    const where = `machines[${index}]`;
    const label = isNonEmptyString(machine?.name) ? machine.name : `№${index + 1}`;

    if (!isNonEmptyString(machine?.id)) errors.push(`${where}.id: обязательное поле`);
    if (!isNonEmptyString(machine?.name)) errors.push(`${where}.name: обязательное поле`);
    if (isNonEmptyString(machine?.id)) {
      if (seen.has(machine.id)) errors.push(`${where}.id: повторяется («${machine.id}»)`);
      seen.add(machine.id);
    }

    if (!isFiniteNumber(machine?.ratePerHour) || machine.ratePerHour < 0) {
      errors.push(`${where} («${label}»): ratePerHour должен быть числом ≥ 0`);
    }
    if (!isFiniteNumber(machine?.minShiftHours) || machine.minShiftHours <= 0) {
      errors.push(`${where} («${label}»): minShiftHours должен быть > 0`);
    }
    if (machine?.status !== undefined && !MACHINE_STATUSES.includes(machine.status)) {
      errors.push(`${where}.status: допустимо «available» или «busy»`);
    }
  });

  if (!Array.isArray(config.deliveryZones)) {
    errors.push('deliveryZones: обязательный массив (может быть пустым)');
    return;
  }

  const zoneIds = new Set();
  config.deliveryZones.forEach((zone, index) => {
    const where = `deliveryZones[${index}]`;
    if (!isNonEmptyString(zone?.id)) errors.push(`${where}.id: обязательное поле`);
    if (!isNonEmptyString(zone?.name)) errors.push(`${where}.name: обязательное поле`);
    if (isNonEmptyString(zone?.id)) {
      if (zoneIds.has(zone.id)) errors.push(`${where}.id: повторяется («${zone.id}»)`);
      zoneIds.add(zone.id);
    }
    if (!isFiniteNumber(zone?.price) || zone.price < 0) {
      errors.push(`${where}.price: стоимость доставки — число ≥ 0`);
    }
    if (zone?.freeFrom !== undefined && (!isFiniteNumber(zone.freeFrom) || zone.freeFrom < 0)) {
      errors.push(`${where}.freeFrom: порог бесплатной доставки — число ≥ 0`);
    }
  });
}

/** Отдаёт конфиг и бросает ошибку, если он невалиден. */
export function getCompany(config = rawConfig) {
  const errors = validateCompany(config);
  if (errors.length > 0) {
    throw new Error(`config/company.json невалиден:\n- ${errors.join('\n- ')}`);
  }
  return config;
}

/** Ищет услугу по id. */
export function findService(id, config = rawConfig) {
  return (config.services ?? []).find((service) => service.id === id) ?? null;
}

/** Ищет уровень мастера по id. */
export function findLevel(id, config = rawConfig) {
  return (config.levels ?? []).find((level) => level.id === id) ?? null;
}

/** Ищет единицу техники по id. */
export function findMachine(id, config = rawConfig) {
  return (config.machines ?? []).find((machine) => machine.id === id) ?? null;
}

/** Ищет зону доставки по id. */
export function findZone(id, config = rawConfig) {
  return (config.deliveryZones ?? []).find((zone) => zone.id === id) ?? null;
}

/**
 * Телеграм-ник без @ и без ссылки t.me.
 * Понимает «@name», «name», «https://t.me/name/», «t.me/name?start=1».
 */
export function telegramUsername(config = rawConfig) {
  let value = String(config.contacts?.telegram ?? '').trim();
  if (!value) return '';

  for (const host of TELEGRAM_HOSTS) {
    const marker = `${host}/`;
    const index = value.indexOf(marker);
    if (index >= 0) {
      value = value.slice(index + marker.length);
      break;
    }
  }

  value = value.replace(/^@/, '').split(/[/?#]/)[0].trim();
  return /^[A-Za-z0-9_]{4,32}$/.test(value) ? value : '';
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
