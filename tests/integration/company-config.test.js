import { describe, expect, it } from 'vitest';
import {
  company,
  findLevel,
  findService,
  getCompany,
  telegramUsername,
  validateCompany,
} from '../../src/core/company.js';
import { formatServicePrice, priceForLevel } from '../../src/core/pricing.js';

describe('config/company.json', () => {
  it('валиден по схеме', () => {
    expect(validateCompany(company)).toEqual([]);
  });

  it('getCompany возвращает тот же конфиг', () => {
    expect(getCompany()).toBe(company);
  });

  it('название и контакты заполнены реальными данными', () => {
    expect(company.companyName).toBe('OldBoy');
    expect(company.contacts.phone).toMatch(/\+7/);
    expect(company.contacts.address).toContain('Тверь');
  });

  it('есть три уровня мастеров', () => {
    expect(company.levels).toHaveLength(3);
    expect(company.levels.map((level) => level.id)).toEqual(['barber', 'top', 'premium']);
    expect(findLevel('top')?.name).toBe('ТОП барбер');
  });

  it('все услуги имеют цену и id', () => {
    expect(company.services.length).toBeGreaterThan(10);

    for (const service of company.services) {
      expect(service.id).toBeTruthy();
      expect(service.name).toBeTruthy();
      const price = formatServicePrice(service);
      expect(price).not.toBe('цена по запросу');
      expect(price).not.toContain('NaN');
    }
  });

  it('мужская стрижка стоит по-разному у разных мастеров', () => {
    const haircut = findService('haircut');
    expect(haircut).not.toBeNull();
    expect(priceForLevel(haircut, 'barber')).toBe(1500);
    expect(priceForLevel(haircut, 'top')).toBe(1800);
    expect(priceForLevel(haircut, 'premium')).toBe(2200);
    expect(formatServicePrice(haircut)).toContain('2');
  });

  it('телеграм-ник нормализуется', () => {
    expect(telegramUsername(company)).toBe('Cuba691');
  });

  it('данные приложения готовы к сборке', () => {
    expect(company.app.appId).toBe('ru.oldboy.barbershop');
    expect(company.app.appName).toBe('OldBoy');
    expect(company.app.exeName).toBe('OldBoy');
  });
});

describe('validateCompany отлавливает ошибки', () => {
  it('пустой конфиг', () => {
    expect(validateCompany(null)[0]).toContain('пуст');
  });

  it('без услуг', () => {
    const broken = { ...company, services: [] };
    expect(validateCompany(broken).join(' ')).toContain('services');
  });

  it('услуга без цены', () => {
    const broken = {
      ...company,
      services: [{ id: 'x', name: 'Услуга', duration: 30 }],
    };
    expect(validateCompany(broken).join(' ')).toContain('цена');
  });

  it('повторяющийся id услуги', () => {
    const broken = {
      ...company,
      services: [
        { id: 'x', name: 'Первая', price: 100 },
        { id: 'x', name: 'Вторая', price: 200 },
      ],
    };
    expect(validateCompany(broken).join(' ')).toContain('повторяется');
  });

  it('плохой appId', () => {
    const broken = { ...company, app: { ...company.app, appId: 'Ru.Bad' } };
    expect(validateCompany(broken).join(' ')).toContain('app.appId');
  });
});
