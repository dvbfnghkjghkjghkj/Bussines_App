import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { templateOf, validateCompany } from '../../src/core/company.js';
import { calcShiftPrice, orderPriceRange } from '../../src/core/pricing.js';

const rental = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../config/examples/rental.json', import.meta.url)), 'utf8'),
);

describe('чистый пример аренды (config/examples/rental.json)', () => {
  it('валиден по схеме', () => {
    expect(validateCompany(rental)).toEqual([]);
    expect(templateOf(rental)).toBe('rental');
  });

  it('в парке есть все три статуса техники', () => {
    const statuses = rental.machines.map((machine) => machine.status);
    expect(statuses).toContain('available');
    expect(statuses).toContain('busy');
    expect(statuses).toContain('confirm');
  });

  it('каждая машина считает смену', () => {
    for (const machine of rental.machines) {
      const shift = calcShiftPrice({ ...machine, hours: 1 });
      expect(shift).toBe(machine.ratePerHour * machine.minShiftHours);
    }
  });

  it('диапазон цены растёт вместе с часами', () => {
    const machine = rental.machines[0];
    const zone = rental.deliveryZones[0];
    const short = orderPriceRange({ machine, hours: machine.minShiftHours, zone });
    const long = orderPriceRange({ machine, hours: machine.minShiftHours * 2, zone });
    expect(long.max).toBeGreaterThan(short.max);
  });

  it('зоны доставки заданы корректно', () => {
    expect(rental.deliveryZones.length).toBeGreaterThan(1);
    for (const zone of rental.deliveryZones) {
      expect(zone.id).toBeTruthy();
      expect(zone.name).toBeTruthy();
      expect(zone.price).toBeGreaterThanOrEqual(0);
    }
  });
});
