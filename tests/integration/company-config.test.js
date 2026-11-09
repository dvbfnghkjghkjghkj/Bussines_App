import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findMachine, telegramUsername, validateCompany } from '../../src/core/company.js';

const configPath = fileURLToPath(new URL('../../config/company.json', import.meta.url));
const raw = JSON.parse(readFileSync(configPath, 'utf8'));

describe('config/company.json', () => {
  it('проходит валидацию', () => {
    expect(validateCompany(raw)).toEqual([]);
  });

  it('содержит обязательные поля персонализации', () => {
    expect(raw).toHaveProperty('companyName');
    expect(raw).toHaveProperty('contacts.phone');
    expect(Array.isArray(raw.machines)).toBe(true);
    expect(Array.isArray(raw.deliveryZones)).toBe(true);
  });

  it('описывает Android-приложение корректным appId', () => {
    expect(raw.app).toBeDefined();
    expect(raw.app.appId).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
    expect(raw.app.appName.length).toBeGreaterThan(0);
    expect(Number.isInteger(raw.app.versionCode)).toBe(true);
  });

  it('у каждой машины есть id, цена и минимальная смена', () => {
    for (const machine of raw.machines) {
      expect(machine.id).toBeTruthy();
      expect(Number.isFinite(machine.ratePerHour)).toBe(true);
      expect(machine.minShiftHours).toBeGreaterThan(0);
    }
  });

  it('находит машину по id и молча возвращает null на неизвестном', () => {
    const first = raw.machines[0];
    expect(findMachine(first.id, raw)).toBe(first);
    expect(findMachine('нет-такой', raw)).toBeNull();
  });

  it('нормализует ник Telegram из контактов', () => {
    expect(telegramUsername({ contacts: { telegram: 'https://t.me/@company/' } })).toBe('company');
  });
});

describe('validateCompany — негативные случаи', () => {
  const base = {
    companyName: 'Компания',
    contacts: { phone: '+7 900 000-00-00' },
    machines: [{ id: 'm1', name: 'Техника', ratePerHour: 1000, minShiftHours: 4 }],
    deliveryZones: [],
  };

  it('требует название компании', () => {
    expect(validateCompany({ ...base, companyName: '  ' })).toContain('companyName: обязательное непустое поле');
  });

  it('требует телефон', () => {
    expect(validateCompany({ ...base, contacts: {} })).toContain('contacts.phone: обязательный непустой телефон');
  });

  it('требует хотя бы одну машину', () => {
    expect(validateCompany({ ...base, machines: [] })).toContain('machines: нужна хотя бы одна единица техники');
  });

  it('ловит отрицательную ставку', () => {
    const broken = { ...base, machines: [{ ...base.machines[0], ratePerHour: -5 }] };
    expect(validateCompany(broken).join(' ')).toContain('ratePerHour');
  });

  it('ловит кривой appId', () => {
    const broken = { ...base, app: { appId: 'Ru.Example.App', appName: 'Приложение' } };
    expect(validateCompany(broken).join(' ')).toContain('app.appId');
  });
});
