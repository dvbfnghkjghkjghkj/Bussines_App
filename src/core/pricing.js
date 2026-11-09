/**
 * Цены и длительность.
 *
 * Два набора функций под два типа шаблона:
 * - услуги: цена зависит от уровня мастера (`priceForLevel`);
 * - аренда: часы × ставка с минимальной сменой плюс доставка (`orderPriceRange`).
 *
 * Чистые функции без DOM: используются на странице, в тестах и при сборке
 * текста заявки. Некорректные значения превращаются в null, а не в «NaN ₽».
 */

export const CURRENCY = '₽';
export const DEFAULT_MIN_SHIFT_HOURS = 4;

/**
 * «1 800 ₽» с неразрывным пробелом — цена не рвётся по строкам.
 * Некорректное значение превращается в пустую строку.
 */
export function formatPrice(value, currency = CURRENCY) {
  const number = toNonNegative(value);
  if (number === null) return '';
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(number))}\u00A0${currency}`;
}

/**
 * Предварительная цена диапазоном — требование проекта: никаких точных
 * обещаний. Границы можно передать в любом порядке, минимум берётся сам.
 */
export function formatPriceRange(from, to, currency = CURRENCY) {
  const a = toNonNegative(from);
  const b = toNonNegative(to);
  if (a === null && b === null) return '';
  if (a === null) return formatPrice(b, currency);
  if (b === null) return formatPrice(a, currency);

  const min = Math.min(a, b);
  const max = Math.max(a, b);
  if (min === max) return formatPrice(min, currency);
  return `${formatPrice(min, currency)}\u00A0–\u00A0${formatPrice(max, currency)}`;
}

/** Длительность услуги: 60 → «1 ч», 45 → «45 мин», 90 → «1 ч 30 мин». */
export function formatDuration(minutes) {
  const value = toNonNegative(minutes);
  if (value === null || value === 0) return '';

  const total = Math.round(value);
  if (total < 60) return `${total}\u00A0мин`;

  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}\u00A0ч` : `${hours}\u00A0ч ${rest}\u00A0мин`;
}

/** Часы смены: 4 → «4 ч». */
export function formatHours(hours) {
  const value = toNonNegative(hours);
  if (value === null) return '';
  return `${new Intl.NumberFormat('ru-RU').format(value)}\u00A0ч`;
}

/** Часы по-русски: 1 час, 4 часа, 8 часов. */
export function formatHoursWord(hours) {
  const value = toNonNegative(hours);
  if (value === null) return '';
  const number = Math.round(value);
  return `${new Intl.NumberFormat('ru-RU').format(number)}\u00A0${plural(number, 'час', 'часа', 'часов')}`;
}

function plural(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

// ---- услуги ----

/** Все известные цены услуги: из карты уровней или единая цена. */
export function servicePrices(service) {
  const values = Object.values(service?.prices ?? {})
    .map((value) => toNonNegative(value))
    .filter((value) => value !== null);

  if (values.length > 0) return values;

  const base = toNonNegative(service?.price);
  return base === null ? [] : [base];
}

/** Диапазон цен услуги: { min, max } или null, если цены нет. */
export function priceRange(service) {
  const values = servicePrices(service);
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Цена услуги для конкретного уровня мастера.
 * Если для уровня цены нет — берётся общая цена услуги, иначе null.
 */
export function priceForLevel(service, levelId) {
  const byLevel = toNonNegative(service?.prices?.[levelId]);
  if (byLevel !== null) return byLevel;
  return toNonNegative(service?.price);
}

/** Готовая подпись цены для карточки: «1 500 – 2 200 ₽» или «1 200 ₽». */
export function formatServicePrice(service, currency = CURRENCY) {
  const range = priceRange(service);
  if (!range) return 'цена по запросу';
  return formatPriceRange(range.min, range.max, currency);
}

// ---- аренда техники ----

/**
 * Оплачиваемые часы: всё, что меньше минимальной смены, считается как смена.
 * hours ≤ 0 → null (заказ не собран).
 */
export function billableHours(hours, minShiftHours = DEFAULT_MIN_SHIFT_HOURS) {
  const value = toNonNegative(hours);
  const min = toNonNegative(minShiftHours) ?? DEFAULT_MIN_SHIFT_HOURS;
  if (value === null || value === 0) return null;
  return Math.max(value, min);
}

/**
 * Стоимость смены: часы округляются вверх до минимальной смены.
 * hours ≤ 0 → null (смену не считаем).
 */
export function calcShiftPrice({ ratePerHour, hours, minShiftHours = DEFAULT_MIN_SHIFT_HOURS } = {}) {
  const rate = toNonNegative(ratePerHour);
  if (rate === null) return null;

  const billed = billableHours(hours, minShiftHours);
  if (billed === null) return null;

  return Math.round(billed * rate);
}

/**
 * Доставка — фиксированная цена зоны (так устроен референс: «в пределах
 * города 5 000 ₽, до 30 км 9 000 ₽, более 30 км 14 000 ₽»).
 * Без зоны доставка не считается (0).
 */
export function deliveryPrice(zone) {
  if (!zone) return 0;
  return toNonNegative(zone.price) ?? 0;
}

/**
 * Итог заказа: смена + доставка.
 * Возвращает { hours, requestedHours, minApplied, shift, delivery, total }
 * или null, если часы не заданы.
 */
export function orderTotal({ machine, hours, zone } = {}) {
  const shift = calcShiftPrice({ ...machine, hours });
  if (shift === null) return null;

  const hoursBilled = billableHours(hours, machine?.minShiftHours);
  const requestedHours = toNonNegative(hours) ?? 0;
  const delivery = deliveryPrice(zone);

  return {
    hours: hoursBilled,
    requestedHours,
    minApplied: hoursBilled > requestedHours,
    shift,
    delivery,
    total: shift + delivery,
  };
}

/**
 * Диапазон предварительной стоимости: от минимальной смены до запрошенных часов.
 * Если часов меньше минимума — диапазон схлопывается в одну цену.
 */
export function orderPriceRange({ machine, hours, zone } = {}) {
  const minShift = toNonNegative(machine?.minShiftHours) ?? DEFAULT_MIN_SHIFT_HOURS;
  const requested = toNonNegative(hours) ?? 0;

  const low = orderTotal({ machine, hours: Math.max(1, minShift), zone });
  const high = orderTotal({ machine, hours: Math.max(requested, minShift), zone });
  if (!low || !high) return null;

  return { min: Math.min(low.total, high.total), max: Math.max(low.total, high.total) };
}

function toNonNegative(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
