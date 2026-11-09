import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatPriceRange, formatServicePrice, priceForLevel, priceRange } from '../../src/core/pricing.js';

const priceValue = fc.integer({ min: 0, max: 20000 });
const levelId = fc.constantFrom('barber', 'top', 'premium');

const serviceWithLevels = fc
  .record({
    barber: priceValue,
    top: priceValue,
    premium: priceValue,
  })
  .map((prices) => ({ id: 's', name: 'Услуга', prices }));

describe('свойства диапазона цен', () => {
  it('минимум никогда не больше максимума', () => {
    fc.assert(
      fc.property(serviceWithLevels, (service) => {
        const range = priceRange(service);
        expect(range.min).toBeLessThanOrEqual(range.max);
      }),
    );
  });

  it('цена любого уровня попадает в диапазон', () => {
    fc.assert(
      fc.property(serviceWithLevels, levelId, (service, level) => {
        const range = priceRange(service);
        const price = priceForLevel(service, level);
        expect(price).toBeGreaterThanOrEqual(range.min);
        expect(price).toBeLessThanOrEqual(range.max);
      }),
    );
  });

  it('диапазон содержит обе границы', () => {
    fc.assert(
      fc.property(priceValue, priceValue, (a, b) => {
        const text = formatPriceRange(a, b);
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        const digits = (value) => value.toLocaleString('ru-RU');

        expect(text).toContain(digits(min));
        if (min !== max) expect(text).toContain(digits(max));
      }),
    );
  });

  it('подпись цены валидной услуги не пустая и без NaN', () => {
    fc.assert(
      fc.property(serviceWithLevels, (service) => {
        const text = formatServicePrice(service);
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toContain('NaN');
      }),
    );
  });
});
