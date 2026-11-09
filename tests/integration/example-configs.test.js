import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { templateOf, validateCompany } from '../../src/core/company.js';
import { calcShiftPrice, orderPriceRange } from '../../src/core/pricing.js';

const readJson = (relativePath) => {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
};

describe('шаблон «услуги» (реальный конфиг)', () => {
  it('объявлен как services', () => {
    const config = readJson('../../config/company.json');
    expect(templateOf(config)).toBe('services');
    expect(validateCompany(config)).toEqual([]);
  });
});

describe('шаблон «аренда» (config/examples/rental.json)', () => {
  const config = readJson('../../config/examples/rental.json');

  it('валиден по схеме аренды', () => {
    expect(validateCompany(config)).toEqual([]);
  });

  it('объявлен как rental', () => {
    expect(templateOf(config)).toBe('rental');
  });

  it('в парке есть свободная и занятая техника', () => {
    const statuses = config.machines.map((machine) => machine.status);
    expect(statuses).toContain('available');
    expect(statuses).toContain('busy');
  });

  it('каждая машина считает смену', () => {
    for (const machine of config.machines) {
      const shift = calcShiftPrice({ ...machine, hours: 1 });
      expect(shift).toBe(machine.ratePerHour * machine.minShiftHours);
    }
  });

  it('диапазон цены растёт вместе с часами', () => {
    const machine = config.machines[0];
    const zone = config.deliveryZones[0];
    const short = orderPriceRange({ machine, hours: machine.minShiftHours, zone });
    const long = orderPriceRange({ machine, hours: machine.minShiftHours * 2, zone });
    expect(long.max).toBeGreaterThan(short.max);
  });

  it('зоны доставки заданы корректно', () => {
    expect(config.deliveryZones.length).toBeGreaterThan(1);
    for (const zone of config.deliveryZones) {
      expect(zone.id).toBeTruthy();
      expect(zone.name).toBeTruthy();
      expect(zone.price).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('аренда без обязательных полей отклоняется', () => {
  it('без техники', () => {
    const broken = { ...readJson('../../config/examples/rental.json'), machines: [] };
    expect(validateCompany(broken).join(' ')).toContain('machines');
  });

  it('без массива зон', () => {
    const config = readJson('../../config/examples/rental.json');
    const broken = { ...config, deliveryZones: undefined };
    expect(validateCompany(broken).join(' ')).toContain('deliveryZones');
  });

  it('неизвестный статус техники', () => {
    const config = readJson('../../config/examples/rental.json');
    const broken = {
      ...config,
      machines: [{ ...config.machines[0], status: 'в ремонте' }],
    };
    expect(validateCompany(broken).join(' ')).toContain('status');
  });
});
