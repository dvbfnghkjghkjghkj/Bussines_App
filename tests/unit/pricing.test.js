import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatPrice,
  formatPriceRange,
  formatServicePrice,
  priceForLevel,
  priceRange,
  servicePrices,
} from '../../src/core/pricing.js';

const NBSP = '\u00A0';
const price = (value) => `${value}${NBSP}₽`;

describe('formatPrice', () => {
  it('разделяет тысячи и добавляет валюту', () => {
    expect(formatPrice(1500)).toBe(`1${NBSP}500${NBSP}₽`);
    expect(formatPrice(2200)).toBe(price(`2${NBSP}200`));
    expect(formatPrice(0)).toBe(price('0'));
  });

  it('принимает строки с числом', () => {
    expect(formatPrice('700')).toBe(price('700'));
  });

  it('округляет дробные значения', () => {
    expect(formatPrice(1500.6)).toBe(`1${NBSP}501${NBSP}₽`);
  });

  it('возвращает пустую строку вместо мусора', () => {
    expect(formatPrice(Number.NaN)).toBe('');
    expect(formatPrice(-1)).toBe('');
    expect(formatPrice(null)).toBe('');
    expect(formatPrice('много')).toBe('');
  });
});

describe('formatPriceRange', () => {
  it('показывает диапазон «от – до»', () => {
    expect(formatPriceRange(1500, 2200)).toBe(
      `1${NBSP}500${NBSP}₽${NBSP}–${NBSP}2${NBSP}200${NBSP}₽`,
    );
  });

  it('границы можно передать в обратном порядке', () => {
    expect(formatPriceRange(2200, 1500)).toBe(formatPriceRange(1500, 2200));
  });

  it('одинаковые границы схлопываются в одну цену', () => {
    expect(formatPriceRange(1500, 1500)).toBe(price(`1${NBSP}500`));
  });

  it('одна граница без второй работает', () => {
    expect(formatPriceRange(null, 900)).toBe(price('900'));
    expect(formatPriceRange(900, null)).toBe(price('900'));
    expect(formatPriceRange(null, null)).toBe('');
  });
});

describe('formatDuration', () => {
  it('минуты без часов', () => {
    expect(formatDuration(45)).toBe(`45${NBSP}мин`);
  });

  it('целые часы', () => {
    expect(formatDuration(60)).toBe(`1${NBSP}ч`);
    expect(formatDuration(120)).toBe(`2${NBSP}ч`);
  });

  it('часы и минуты', () => {
    expect(formatDuration(90)).toBe(`1${NBSP}ч 30${NBSP}мин`);
  });

  it('ноль и мусор дают пустую строку', () => {
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(null)).toBe('');
    expect(formatDuration('abc')).toBe('');
  });
});

describe('цены услуги', () => {
  const withLevels = { prices: { barber: 1500, top: 1800, premium: 2200 } };
  const single = { price: 1200 };
  const empty = {};

  it('servicePrices собирает цены уровней', () => {
    expect(servicePrices(withLevels)).toEqual([1500, 1800, 2200]);
  });

  it('servicePrices берёт единую цену', () => {
    expect(servicePrices(single)).toEqual([1200]);
    expect(servicePrices(empty)).toEqual([]);
  });

  it('priceRange считает минимум и максимум', () => {
    expect(priceRange(withLevels)).toEqual({ min: 1500, max: 2200 });
    expect(priceRange(single)).toEqual({ min: 1200, max: 1200 });
    expect(priceRange(empty)).toBeNull();
  });

  it('priceForLevel берёт цену уровня', () => {
    expect(priceForLevel(withLevels, 'top')).toBe(1800);
  });

  it('priceForLevel откатывается на общую цену', () => {
    expect(priceForLevel(single, 'top')).toBe(1200);
    expect(priceForLevel(empty, 'top')).toBeNull();
  });

  it('formatServicePrice собирает подпись для карточки', () => {
    expect(formatServicePrice(withLevels)).toBe(
      `1${NBSP}500${NBSP}₽${NBSP}–${NBSP}2${NBSP}200${NBSP}₽`,
    );
    expect(formatServicePrice(single)).toBe(price(`1${NBSP}200`));
    expect(formatServicePrice(empty)).toBe('цена по запросу');
  });
});
