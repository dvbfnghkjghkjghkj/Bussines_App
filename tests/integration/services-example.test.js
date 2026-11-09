import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  findLevel,
  findService,
  telegramUsername,
  templateOf,
  validateCompany,
} from '../../src/core/company.js';
import { formatServicePrice, priceForLevel } from '../../src/core/pricing.js';

const services = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../config/examples/services.json', import.meta.url)), 'utf8'),
);

describe('шаблон услуг (config/examples/services.json)', () => {
  it('валиден и объявлен как services', () => {
    expect(validateCompany(services)).toEqual([]);
    expect(templateOf(services)).toBe('services');
  });

  it('это пример барбершопа OldBoy', () => {
    expect(services.companyName).toBe('OldBoy');
    expect(services.contacts.address).toContain('Тверь');
  });

  it('три уровня мастеров', () => {
    expect(services.levels).toHaveLength(3);
    expect(findLevel('top', services)?.name).toBe('ТОП барбер');
  });

  it('все услуги имеют цену', () => {
    expect(services.services.length).toBeGreaterThan(10);
    for (const service of services.services) {
      expect(service.id).toBeTruthy();
      expect(service.name).toBeTruthy();
      const price = formatServicePrice(service);
      expect(price).not.toBe('цена по запросу');
      expect(price).not.toContain('NaN');
    }
  });

  it('цена зависит от уровня мастера', () => {
    const haircut = findService('haircut', services);
    expect(priceForLevel(haircut, 'barber')).toBe(1500);
    expect(priceForLevel(haircut, 'top')).toBe(1800);
    expect(priceForLevel(haircut, 'premium')).toBe(2200);
  });

  it('телеграм-ник нормализуется', () => {
    expect(telegramUsername(services)).toBe('Cuba691');
  });
});
