import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIN_SHIFT_HOURS,
  calcShiftPrice,
  formatHours,
  formatPrice,
  formatPriceRange,
} from '../../src/core/pricing.js';

describe('calcShiftPrice', () => {
  it('считает цену по фактическим часам, если они больше минимума', () => {
    expect(calcShiftPrice({ ratePerHour: 1800, hours: 6, minShiftHours: 4 })).toBe(10800);
  });

  it('поднимает часы до минимальной смены', () => {
    expect(calcShiftPrice({ ratePerHour: 1800, hours: 3, minShiftHours: 4 })).toBe(7200);
  });

  it('на границе минимальной смены цена не меняется', () => {
    expect(calcShiftPrice({ ratePerHour: 1800, hours: 4, minShiftHours: 4 })).toBe(7200);
  });

  it('ноль часов даёт ноль рублей, а не минимальную смену', () => {
    expect(calcShiftPrice({ ratePerHour: 1800, hours: 0, minShiftHours: 4 })).toBe(0);
  });

  it('использует минимальную смену по умолчанию', () => {
    expect(DEFAULT_MIN_SHIFT_HOURS).toBe(4);
    expect(calcShiftPrice({ ratePerHour: 1000, hours: 1 })).toBe(4000);
  });

  it('округляет дробные часы до целых рублей', () => {
    expect(calcShiftPrice({ ratePerHour: 999, hours: 2.5, minShiftHours: 1 })).toBe(2498);
  });

  it('отвергает отрицательную ставку', () => {
    expect(() => calcShiftPrice({ ratePerHour: -1, hours: 4 })).toThrow(RangeError);
  });

  it('отвергает нулевую минимальную смену', () => {
    expect(() => calcShiftPrice({ ratePerHour: 1000, hours: 4, minShiftHours: 0 })).toThrow(RangeError);
  });
});

describe('formatPrice', () => {
  it('разделяет тысячи пробелом и добавляет валюту', () => {
    expect(formatPrice(1800)).toBe('1\u00A0800\u00A0₽');
  });

  it('не добавляет разделитель для сотен', () => {
    expect(formatPrice(950)).toBe('950\u00A0₽');
  });
});

describe('formatPriceRange', () => {
  it('показывает диапазон через тире', () => {
    expect(formatPriceRange(5000, 8000)).toBe('5\u00A0000\u00A0₽ – 8\u00A0000\u00A0₽');
  });

  it('схлопывает равные границы в одно число', () => {
    expect(formatPriceRange(100, 100)).toBe('100\u00A0₽');
  });

  it('падает, если границы перепутаны', () => {
    expect(() => formatPriceRange(200, 100)).toThrow(RangeError);
  });
});

describe('formatHours', () => {
  it('добавляет единицу измерения', () => {
    expect(formatHours(4)).toBe('4\u00A0ч');
  });
});
