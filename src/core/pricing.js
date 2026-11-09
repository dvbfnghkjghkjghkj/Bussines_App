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
 * Стоимость смены: часы округляются вверх до минимальной смены.
 * hours ≤ 0 → null (смену не считаем), иначе — максимум из часов и минимума.
 */
export function calcShiftPrice({ ratePerHour, hours, minShiftHours = DEFAULT_MIN_SHIFT_HOURS } = {}) {
  const rate = toNonNegative(ratePerHour);
  const min = toNonNegative(minShiftHours);
  const value = toNonNegative(hours);
  if (rate === null || min === null || value === null) return null;
  if (value === 0) return null;

  return Math.round(Math.max(value, min) * rate);
}

/**
 * Доставка по зоне: бесплатно, если сумма заказа дошла до порога `freeFrom`.
 * Без зоны доставка не считается (0).
 */
export function deliveryPrice(zone, subtotal = 0) {
  if (!zone) return 0;
  const price = toNonNegative(zone.price) ?? 0;
  const threshold = toNonNegative(zone.freeFrom) ?? 0;
  const sum = toNonNegative(subtotal) ?? 0;
  if (threshold > 0 && sum >= threshold) return 0;
  return price;
}

/**
 * Итог заказа: смена + доставка.
 * Возвращает { shift, delivery, total } или null, если часы не заданы.
 */
export function orderTotal({ machine, hours, zone } = {}) {
  const shift = calcShiftPrice({ ...machine, hours });
  if (shift === null) return null;
  const delivery = deliveryPrice(zone, shift);
  return { shift, delivery, total: shift + delivery };
}

/**
 * Диапазон предварительной стоимости: от минимальной смены до запрошенных часов.
 * Если часов меньше минимума — диапазон схлопывается в одну цену.
 */
export function orderPriceRange({ machine, hours, zone } = {}) {
  const rate = toNonNegative(machine?.ratePerHour);
  const minShift = toNonNegative(machine?.minShiftHours) ?? DEFAULT_MIN_SHIFT_HOURS;
  if (rate === null || rate === 0) return null;

  const fromHours = Math.max(1, minShift);
  const requested = toNonNegative(hours) ?? 0;
  const toHours = Math.max(requested, fromHours);

  const fromShift = Math.round(fromHours * rate);
  const toShift = Math.round(toHours * rate);

  const fromTotal = fromShift + deliveryPrice(zone, fromShift);
  const toTotal = toShift + deliveryPrice(zone, toShift);
  return { min: Math.min(fromTotal, toTotal), max: Math.max(fromTotal, toTotal) };
}

function toNonNegative(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
