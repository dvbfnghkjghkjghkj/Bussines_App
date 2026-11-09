import { describe, expect, it } from 'vitest';
import { canSelectStatus, MACHINE_STATUS_LABELS, MACHINE_STATUSES } from '../../src/core/company.js';
import {
  clearOverrides,
  mergeMachines,
  parkStats,
  PARK_STORAGE_KEY,
  readOverrides,
  writeOverride,
} from '../../src/core/overrides.js';

describe('статусы техники', () => {
  it('три статуса с подписями', () => {
    expect(MACHINE_STATUSES).toEqual(['available', 'busy', 'confirm']);
    expect(MACHINE_STATUS_LABELS.available).toBe('Свободна');
    expect(MACHINE_STATUS_LABELS.busy).toBe('Занята');
    expect(MACHINE_STATUS_LABELS.confirm).toBe('Требует подтверждения');
  });

  it('занятую выбрать нельзя, остальные можно', () => {
    expect(canSelectStatus('busy')).toBe(false);
    expect(canSelectStatus('available')).toBe(true);
    expect(canSelectStatus('confirm')).toBe(true);
  });
});

describe('панель владельца: правки в localStorage', () => {
  const createStorage = () => {
    const map = new Map();
    return {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: (key) => map.delete(key),
      keys: () => [...map.keys()],
    };
  };

  it('пустое хранилище — пустые правки', () => {
    expect(readOverrides(createStorage())).toEqual({});
  });

  it('сохраняет цену, смену и статус', () => {
    const storage = createStorage();
    writeOverride(storage, 'mini-excavator', {
      ratePerHour: 3200,
      minShiftHours: 6,
      status: 'confirm',
    });

    expect(readOverrides(storage)).toEqual({
      'mini-excavator': { ratePerHour: 3200, minShiftHours: 6, status: 'confirm' },
    });
  });

  it('битый JSON не роняет страницу', () => {
    const storage = createStorage();
    storage.setItem(PARK_STORAGE_KEY, '{не json');
    expect(readOverrides(storage)).toEqual({});
  });

  it('нечисловая цена и неизвестный статус отбрасываются', () => {
    const storage = createStorage();
    writeOverride(storage, 'x', { ratePerHour: 'дорого', status: 'в ремонте' });
    expect(readOverrides(storage)).toEqual({});
  });

  it('сброс возвращает пустые правки', () => {
    const storage = createStorage();
    writeOverride(storage, 'x', { ratePerHour: 1000 });
    expect(clearOverrides(storage)).toEqual({});
    expect(readOverrides(storage)).toEqual({});
  });

  it('накладывает правки на технику из конфига', () => {
    const machines = [
      { id: 'a', name: 'A', ratePerHour: 1000, minShiftHours: 4, status: 'available' },
      { id: 'b', name: 'B', ratePerHour: 2000, minShiftHours: 4, status: 'available' },
    ];

    const merged = mergeMachines(machines, { a: { ratePerHour: 1500, status: 'busy' } });
    expect(merged[0]).toMatchObject({ ratePerHour: 1500, minShiftHours: 4, status: 'busy' });
    expect(merged[1]).toMatchObject({ ratePerHour: 2000, status: 'available' });
    expect(merged[1]).toBe(machines[1]);
  });

  it('сводка по парку считает статусы', () => {
    const stats = parkStats([
      { status: 'available' },
      { status: 'busy' },
      { status: 'confirm' },
      { status: 'available' },
    ]);
    expect(stats).toEqual({ available: 2, busy: 1, confirm: 1, total: 4 });
  });
});
