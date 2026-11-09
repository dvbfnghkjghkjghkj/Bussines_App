/**
 * Цены и длительность услуг.
 *
 * Чистые функции без DOM: используются на странице, в тестах и при сборке
 * текста заявки. Цена зависит от уровня мастера (Барбер / ТОП / ПРЕМИУМ),
 * услуги без уровня имеют одну цену в поле `price`.
 */

export const CURRENCY = '₽';

/**
 * «1 800 ₽» с неразрывным пробелом — цена не рвётся по строкам.
 * Некорректное значение превращается в пустую строку, а не в «NaN ₽».
 */
export function formatPrice(value, currency = CURRENCY) {
  const number = toNonNegative(value);
  if (number === null) return '';
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(number))}\u00A0${currency}`;
}

/**
 * Предварительная цена диапазоном — требование проекта: никаких точных
 * обещаний. Границы можно передать в любом порядке, минимум берётся сам.
 * (1500, 2200) → «1 500 – 2 200 ₽»; (1500, 1500) → «1 500 ₽».
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

function toNonNegative(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
