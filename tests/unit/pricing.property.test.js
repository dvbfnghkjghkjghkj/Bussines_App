import { describe, it } from 'vitest';
import fc from 'fast-check';
import { calcShiftPrice } from '../../src/core/pricing.js';

describe('calcShiftPrice — свойства', () => {
  it('цена всегда кратна ставке (при целых часах)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 0, max: 72 }),
        fc.integer({ min: 1, max: 24 }),
        (ratePerHour, hours, minShiftHours) => {
          const price = calcShiftPrice({ ratePerHour, hours, minShiftHours });
          if (ratePerHour === 0) return price === 0;
          if (hours === 0) return price === 0;
          return price % ratePerHour === 0 && price >= 0;
        },
      ),
      { numRuns: 300 },
    );
  });

  it('цена не убывает с ростом часов', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 24 }),
        fc.integer({ min: 1, max: 24 }),
        (ratePerHour, hours, extra, minShiftHours) => {
          const a = calcShiftPrice({ ratePerHour, hours, minShiftHours });
          const b = calcShiftPrice({ ratePerHour, hours: hours + extra, minShiftHours });
          return b >= a;
        },
      ),
      { numRuns: 300 },
    );
  });

  it('оплата равна хотя бы минимальной смене, если часы больше нуля', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 1, max: 72 }),
        fc.integer({ min: 1, max: 24 }),
        (ratePerHour, hours, minShiftHours) => {
          const price = calcShiftPrice({ ratePerHour, hours, minShiftHours });
          return price >= ratePerHour * minShiftHours;
        },
      ),
      { numRuns: 300 },
    );
  });

  it('не принимает отрицательные значения', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000, max: -1 }), fc.integer({ min: 1, max: 24 }), (rate, minShiftHours) => {
        try {
          calcShiftPrice({ ratePerHour: rate, hours: 4, minShiftHours });
          return false;
        } catch (error) {
          return error instanceof RangeError;
        }
      }),
      { numRuns: 100 },
    );
  });
});
