import { describe, expect, it } from 'vitest';
import {
  company,
  findMachine,
  findZone,
  getCompany,
  MACHINE_STATUS_LABELS,
  templateOf,
  telegramUsername,
  validateCompany,
} from '../../src/core/company.js';
import { orderTotal } from '../../src/core/pricing.js';

describe('активный конфиг — аренда спецтехники (СТРОЙМАШ)', () => {
  it('валиден по схеме', () => {
    expect(validateCompany(company)).toEqual([]);
  });

  it('getCompany возвращает тот же конфиг', () => {
    expect(getCompany()).toBe(company);
  });

  it('выбран шаблон rental', () => {
    expect(templateOf(company)).toBe('rental');
  });

  it('название и контакты заполнены', () => {
    expect(company.companyName).toBe('СТРОЙМАШ');
    expect(company.contacts.phone).toMatch(/\+7/);
    expect(company.contacts.address).toContain('Екатеринбург');
  });

  it('в парке четыре машины с тремя статусами', () => {
    expect(company.machines).toHaveLength(4);

    const statuses = company.machines.map((machine) => machine.status);
    expect(new Set(statuses)).toEqual(new Set(['available', 'busy', 'confirm']));

    for (const machine of company.machines) {
      expect(MACHINE_STATUS_LABELS[machine.status]).toBeTruthy();
      expect(machine.ratePerHour).toBeGreaterThan(0);
      expect(machine.minShiftHours).toBeGreaterThan(0);
    }
  });

  it('техника ищется по id', () => {
    const machine = findMachine('wheel-loader');
    expect(machine.name).toBe('Фронтальный погрузчик');
  });

  it('цены и смены совпадают с референсом', () => {
    const byId = Object.fromEntries(company.machines.map((machine) => [machine.id, machine]));
    expect(byId['mini-excavator']).toMatchObject({ ratePerHour: 2500, minShiftHours: 4 });
    expect(byId['crawler-excavator']).toMatchObject({ ratePerHour: 3800, minShiftHours: 8 });
    expect(byId['wheel-loader']).toMatchObject({ ratePerHour: 3200, minShiftHours: 4 });
    expect(byId['manipulator']).toMatchObject({ ratePerHour: 2800, minShiftHours: 4 });
  });

  it('зоны доставки — фиксированные цены из референса', () => {
    expect(findZone('city')).toMatchObject({ price: 5000 });
    expect(findZone('up30')).toMatchObject({ price: 9000 });
    expect(findZone('over30')).toMatchObject({ price: 14000 });
  });

  it('пример из скриншота: погрузчик 8 ч + город = 30 600 ₽', () => {
    const total = orderTotal({
      machine: findMachine('wheel-loader'),
      hours: 8,
      zone: findZone('city'),
    });
    expect(total).toEqual({
      hours: 8,
      requestedHours: 8,
      minApplied: false,
      shift: 25600,
      delivery: 5000,
      total: 30600,
    });
  });

  it('пример из скриншота: 1 час считается как минимальная смена', () => {
    const total = orderTotal({
      machine: findMachine('wheel-loader'),
      hours: 1,
      zone: findZone('city'),
    });
    expect(total).toMatchObject({ hours: 4, minApplied: true, shift: 12800, total: 17800 });
  });

  it('телеграм-ник владельца нормализуется', () => {
    expect(telegramUsername(company)).toBe('Cuba691');
  });

  it('у каждой машины есть фото', () => {
    for (const machine of company.machines) {
      expect(machine.photo).toMatch(/^images\/machines\/.+\.jpg$/);
    }
  });

  it('данные приложения готовы к сборке', () => {
    expect(company.app.appId).toBe('ru.stroymash.rental');
    expect(company.app.exeName).toBe('StroyMash');
  });
});

describe('validateCompany отлавливает ошибки аренды', () => {
  it('пустой конфиг', () => {
    expect(validateCompany(null)[0]).toContain('пуст');
  });

  it('без техники', () => {
    const broken = { ...company, machines: [] };
    expect(validateCompany(broken).join(' ')).toContain('machines');
  });

  it('техника без ставки', () => {
    const broken = {
      ...company,
      machines: [{ id: 'x', name: 'Машина', minShiftHours: 4 }],
    };
    expect(validateCompany(broken).join(' ')).toContain('ratePerHour');
  });

  it('неизвестный статус техники', () => {
    const broken = {
      ...company,
      machines: [{ ...company.machines[0], status: 'в ремонте' }],
    };
    expect(validateCompany(broken).join(' ')).toContain('status');
  });

  it('без массива зон доставки', () => {
    const broken = { ...company, deliveryZones: undefined };
    expect(validateCompany(broken).join(' ')).toContain('deliveryZones');
  });

  it('плохой appId', () => {
    const broken = { ...company, app: { ...company.app, appId: 'Ru.Bad' } };
    expect(validateCompany(broken).join(' ')).toContain('app.appId');
  });
});
