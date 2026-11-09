import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIN_SHIFT_HOURS,
  billableHours,
  calcShiftPrice,
  deliveryPrice,
  formatHours,
  formatHoursWord,
  orderPriceRange,
  orderTotal,
} from '../../src/core/pricing.js';

const machine = { ratePerHour: 2000, minShiftHours: 4 };
const zone = { id: 'city', name: 'В пределах города', price: 5000 };

describe('billableHours', () => {
  it('меньше минимума — считается как минимальная смена', () => {
    expect(billableHours(1, 4)).toBe(4);
    expect(billableHours(3, 4)).toBe(4);
  });

  it('больше минимума — фактические часы', () => {
    expect(billableHours(8, 4)).toBe(8);
  });

  it('ноль и мусор — null', () => {
    expect(billableHours(0, 4)).toBeNull();
    expect(billableHours('много', 4)).toBeNull();
  });

  it('минимум по умолчанию', () => {
    expect(billableHours(2)).toBe(DEFAULT_MIN_SHIFT_HOURS);
  });
});

describe('calcShiftPrice', () => {
  it('умножает ставку на минимальную смену', () => {
    expect(calcShiftPrice({ ...machine, hours: 1 })).toBe(8000);
  });

  it('больше минимума — считает фактические часы', () => {
    expect(calcShiftPrice({ ...machine, hours: 8 })).toBe(16000);
  });

  it('ноль часов — смены нет', () => {
    expect(calcShiftPrice({ ...machine, hours: 0 })).toBeNull();
  });

  it('мусор вместо чисел — null', () => {
    expect(calcShiftPrice({ ratePerHour: 'дорого', hours: 4 })).toBeNull();
  });
});

describe('deliveryPrice', () => {
  it('фиксированная цена зоны', () => {
    expect(deliveryPrice(zone)).toBe(5000);
    expect(deliveryPrice({ price: 14000 })).toBe(14000);
  });

  it('бесплатная зона', () => {
    expect(deliveryPrice({ price: 0 })).toBe(0);
  });

  it('без зоны — 0', () => {
    expect(deliveryPrice(null)).toBe(0);
    expect(deliveryPrice(undefined)).toBe(0);
  });
});

describe('orderTotal', () => {
  it('складывает смену и доставку', () => {
    expect(orderTotal({ machine, hours: 8, zone })).toEqual({
      hours: 8,
      requestedHours: 8,
      minApplied: false,
      shift: 16000,
      delivery: 5000,
      total: 21000,
    });
  });

  it('часы ниже минимума — считает по смене и помечает это', () => {
    expect(orderTotal({ machine, hours: 1, zone })).toEqual({
      hours: 4,
      requestedHours: 1,
      minApplied: true,
      shift: 8000,
      delivery: 5000,
      total: 13000,
    });
  });

  it('без часов итога нет', () => {
    expect(orderTotal({ machine, hours: 0, zone })).toBeNull();
    expect(orderTotal({})).toBeNull();
  });
});

describe('orderPriceRange', () => {
  it('нижняя граница — минимальная смена, верхняя — запрошенные часы', () => {
    expect(orderPriceRange({ machine, hours: 8, zone })).toEqual({
      min: 8000 + 5000,
      max: 16000 + 5000,
    });
  });

  it('часы меньше минимума — одна цена', () => {
    expect(orderPriceRange({ machine, hours: 2, zone })).toEqual({ min: 13000, max: 13000 });
  });

  it('без техники — null', () => {
    expect(orderPriceRange({ machine: null, hours: 4 })).toBeNull();
  });
});

describe('формат часов', () => {
  it('formatHours — с неразрывным пробелом', () => {
    expect(formatHours(4)).toBe('4\u00A0ч');
  });

  it('formatHoursWord — по-русски', () => {
    expect(formatHoursWord(1)).toBe('1\u00A0час');
    expect(formatHoursWord(2)).toBe('2\u00A0часа');
    expect(formatHoursWord(5)).toBe('5\u00A0часов');
    expect(formatHoursWord(21)).toBe('21\u00A0час');
  });

  it('мусор — пустая строка', () => {
    expect(formatHoursWord(null)).toBe('');
    expect(formatHours('много')).toBe('');
  });
});
