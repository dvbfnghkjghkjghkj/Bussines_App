import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIN_SHIFT_HOURS,
  calcShiftPrice,
  deliveryPrice,
  formatHours,
  orderPriceRange,
  orderTotal,
} from '../../src/core/pricing.js';

const machine = { ratePerHour: 2000, minShiftHours: 4 };
const zone = { price: 1500, freeFrom: 15000 };

describe('calcShiftPrice', () => {
  it('умножает ставку на минимальную смену', () => {
    expect(calcShiftPrice({ ...machine, hours: 1 })).toBe(8000);
  });

  it('больше минимума — считает фактические часы', () => {
    expect(calcShiftPrice({ ...machine, hours: 8 })).toBe(16000);
  });

  it('минимальная смена по умолчанию', () => {
    expect(calcShiftPrice({ ratePerHour: 1000, hours: 2 })).toBe(1000 * DEFAULT_MIN_SHIFT_HOURS);
  });

  it('ноль часов — смены нет', () => {
    expect(calcShiftPrice({ ...machine, hours: 0 })).toBeNull();
  });

  it('мусор вместо чисел — null', () => {
    expect(calcShiftPrice({ ratePerHour: 'дорого', hours: 4 })).toBeNull();
  });
});

describe('deliveryPrice', () => {
  it('обычная доставка стоит своих денег', () => {
    expect(deliveryPrice(zone, 8000)).toBe(1500);
  });

  it('порог бесплатной доставки срабатывает', () => {
    expect(deliveryPrice(zone, 16000)).toBe(0);
  });

  it('без зоны доставка не считается', () => {
    expect(deliveryPrice(null, 8000)).toBe(0);
  });

  it('зона без порога всегда платная', () => {
    expect(deliveryPrice({ price: 3000, freeFrom: 0 }, 99000)).toBe(3000);
  });
});

describe('orderTotal', () => {
  it('складывает смену и доставку', () => {
    expect(orderTotal({ machine, hours: 4, zone })).toEqual({
      shift: 8000,
      delivery: 1500,
      total: 9500,
    });
  });

  it('бесплатная доставка входит в итог', () => {
    expect(orderTotal({ machine, hours: 8, zone })).toEqual({
      shift: 16000,
      delivery: 0,
      total: 16000,
    });
  });

  it('без часов итога нет', () => {
    expect(orderTotal({ machine, hours: 0, zone })).toBeNull();
  });
});

describe('orderPriceRange', () => {
  it('минимальная смена — нижняя граница, запрошенные часы — верхняя', () => {
    expect(orderPriceRange({ machine, hours: 8, zone })).toEqual({
      min: 8000 + 1500,
      max: 16000,
    });
  });

  it('часы меньше минимума — одна цена', () => {
    expect(orderPriceRange({ machine, hours: 2, zone })).toEqual({
      min: 8000 + 1500,
      max: 8000 + 1500,
    });
  });

  it('без запрошенных часов показывает минимум', () => {
    const range = orderPriceRange({ machine, hours: 0, zone });
    expect(range.min).toBe(range.max);
  });

  it('без техники — null', () => {
    expect(orderPriceRange({ machine: null, hours: 4 })).toBeNull();
  });
});

describe('formatHours', () => {
  it('часы с неразрывным пробелом', () => {
    expect(formatHours(4)).toBe('4\u00A0ч');
    expect(formatHours(8)).toBe('8\u00A0ч');
  });

  it('мусор — пустая строка', () => {
    expect(formatHours(null)).toBe('');
    expect(formatHours('много')).toBe('');
  });
});
