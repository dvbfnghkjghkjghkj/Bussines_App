import { describe, expect, it } from 'vitest';
import {
  company,
  findMachine,
  findZone,
  getCompany,
  telegramUsername,
  templateOf,
  validateCompany,
} from '../../src/core/company.js';

describe('активный конфиг — аренда спецтехники', () => {
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
    expect(company.companyName).toBeTruthy();
    expect(company.contacts.phone).toMatch(/\+7/);
    expect(company.contacts.address).toBeTruthy();
  });

  it('в парке есть техника со ставкой и минимальной сменой', () => {
    expect(company.machines.length).toBeGreaterThanOrEqual(3);
    for (const machine of company.machines) {
      expect(machine.id).toBeTruthy();
      expect(machine.name).toBeTruthy();
      expect(machine.ratePerHour).toBeGreaterThan(0);
      expect(machine.minShiftHours).toBeGreaterThan(0);
    }
  });

  it('зоны доставки заданы и ищутся по id', () => {
    expect(company.deliveryZones.length).toBeGreaterThan(0);
    expect(findZone(company.deliveryZones[0].id)).toBe(company.deliveryZones[0]);
  });

  it('техника ищется по id', () => {
    const first = company.machines[0];
    expect(findMachine(first.id)).toBe(first);
  });

  it('телеграм-ник нормализуется', () => {
    expect(telegramUsername(company)).toBeTruthy();
  });

  it('данные приложения готовы к сборке', () => {
    expect(company.app.appId).toMatch(/^ru\./);
    expect(company.app.appName).toBeTruthy();
    expect(company.app.exeName).toBeTruthy();
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

  it('нулевая минимальная смена', () => {
    const broken = {
      ...company,
      machines: [{ id: 'x', name: 'Машина', ratePerHour: 1000, minShiftHours: 0 }],
    };
    expect(validateCompany(broken).join(' ')).toContain('minShiftHours');
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
