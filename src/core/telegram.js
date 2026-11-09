/**
 * Заявки в Telegram без токена бота.
 *
 * В APK токен бота держать нельзя: он извлекается из бинарника и даёт доступ
 * к боту. Поэтому Android открывает чат компании через deep link tg://
 * с уже заполненным текстом, а веб — через share-ссылку t.me.
 */

/** Нормализует ник: убирает @, t.me/ и лишние слэши. Пустая строка — не ник. */
export function normalizeUsername(raw) {
  let value = String(raw ?? '').trim();
  if (!value) return '';

  for (const host of ['t.me', 'telegram.me', 'telegram.dog']) {
    const marker = `${host}/`;
    const index = value.indexOf(marker);
    if (index >= 0) {
      value = value.slice(index + marker.length);
      break;
    }
  }

  value = value.replace(/^@/, '').split(/[/?#]/)[0].trim();
  return /^[A-Za-z0-9_]{4,32}$/.test(value) ? value : '';
}

/** Текст заявки. Пустые строки выбрасываем, чтобы не было «— undefined». */
export function buildBookingText({
  companyName = '',
  name = '',
  phone = '',
  serviceName = '',
  levelName = '',
  machineName = '',
  hours = '',
  address = '',
  zoneName = '',
  when = '',
  priceText = '',
  comment = '',
} = {}) {
  const lines = [companyName.trim() ? `Запись — ${companyName.trim()}` : 'Запись', ''];
  if (name.trim()) lines.push(`Имя: ${name.trim()}`);
  if (phone.trim()) lines.push(`Телефон: ${phone.trim()}`);
  if (serviceName.trim()) lines.push(`Услуга: ${serviceName.trim()}`);
  if (levelName.trim()) lines.push(`Мастер: ${levelName.trim()}`);
  if (machineName.trim()) lines.push(`Техника: ${machineName.trim()}`);
  if (String(hours).trim()) lines.push(`Часов: ${String(hours).trim()}`);
  if (address.trim()) lines.push(`Адрес: ${address.trim()}`);
  if (zoneName.trim()) lines.push(`Доставка: ${zoneName.trim()}`);
  if (when.trim()) lines.push(`Когда: ${when.trim()}`);
  if (priceText.trim()) lines.push(`Цена: ${priceText.trim()}`);
  if (comment.trim()) lines.push(`Комментарий: ${comment.trim()}`);
  if (lines.length === 2) lines.push('Пользователь не заполнил поля.');
  return lines.join('\n');
}

/** tg:// — открывает конкретный чат с Telegram на телефоне. */
export function buildTelegramDeepLink(username, text = '') {
  const user = normalizeUsername(username);
  if (!user) return null;
  const params = new URLSearchParams({ domain: user });
  if (text) params.set('text', text);
  return `tg://resolve?${params.toString()}`;
}

/** https://t.me/... — запасной путь, если Telegram не установлен. */
export function buildTelegramChatLink(username) {
  const user = normalizeUsername(username);
  return user ? `https://t.me/${user}` : null;
}

/** https://t.me/share/... — веб-сценарий: выбор чата с готовым текстом. */
export function buildTelegramShareLink(text = '', pageUrl = '') {
  const params = new URLSearchParams();
  if (text) params.set('text', text);
  if (pageUrl) params.set('url', pageUrl);
  return `https://t.me/share/url?${params.toString()}`;
}

/**
 * Выбирает ссылку под платформу: в APK — deep link, в браузере — share.
 * Возвращает null, если контакт Telegram не заполнен.
 */
export function pickTelegramLink({ username, text = '', pageUrl = '', isNative = false }) {
  if (!normalizeUsername(username)) return null;
  return isNative
    ? buildTelegramDeepLink(username, text)
    : buildTelegramShareLink(text, pageUrl);
}
