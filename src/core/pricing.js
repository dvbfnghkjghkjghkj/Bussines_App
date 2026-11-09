export const DEFAULT_MIN_SHIFT_HOURS = 4;
export const CURRENCY = '₽';

/**
 * Стоимость смены: часы округляются вверх до минимальной смены.
 * Граничные случаи: hours ≤ 0 → 0, любое hours < minShiftHours → minShiftHours.
 */
export function calcShiftPrice({ ratePerHour, hours, minShiftHours = DEFAULT_MIN_SHIFT_HOURS }) {
  assertNonNegative(ratePerHour, 'ratePerHour');
  assertNonNegative(hours, 'hours');
  assertPositive(minShiftHours, 'minShiftHours');

  if (hours <= 0) return 0;

  const billableHours = Math.max(hours, minShiftHours);
  return Math.round(billableHours * ratePerHour);
}

/** «1 800 ₽» с неразрывными пробелами — так цена не рвётся по строкам. */
export function formatPrice(value, currency = CURRENCY) {
  assertNonNegative(value, 'value');
  const rounded = Math.round(value);
  return `${new Intl.NumberFormat('ru-RU').format(rounded)}\u00A0${currency}`;
}

/**
 * Предварительная цена диапазоном — требование проекта: никаких точных
 * обещаний. Если границы равны, отдаём одно число.
 */
export function formatPriceRange(min, max, currency = CURRENCY) {
  assertNonNegative(min, 'min');
  assertNonNegative(max, 'max');
  if (min > max) {
    throw new RangeError('formatPriceRange: min не может быть больше max');
  }
  if (min === max) return formatPrice(min, currency);
  return `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`;
}

/** Часы работы смены в человеческом виде: 4 → «4 ч». */
export function formatHours(hours) {
  assertNonNegative(hours, 'hours');
  return `${new Intl.NumberFormat('ru-RU').format(hours)}\u00A0ч`;
}

function assertNonNegative(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name}: ожидается конечное число ≥ 0, получено ${value}`);
  }
}

function assertPositive(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name}: ожидается конечное число > 0, получено ${value}`);
  }
}
