/**
 * Заявки в Telegram без токена бота.
 *
 * В APK токен бота держать нельзя: он извлекается из бинарника и даёт доступ
 * к боту. Поэтому Android открывает чат компании через deep link tg://
 * с уже заполненным текстом, а веб — через share-ссылку t.me.
 */

/** Нормализует ник: убирает @, t.me/ и лишние слэши. */
export function normalizeUsername(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/^https?:\/\/t\.me\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');
}

/** Текст заявки. Пустые строки выбрасываем, чтобы не было «— undefined». */
export function buildRequestText({ name = '', phone = '', machineName = '', hours = 0, comment = '' } = {}) {
  const lines = ['Заявка с сайта', ''];
  if (name.trim()) lines.push(`Имя: ${name.trim()}`);
  if (phone.trim()) lines.push(`Телефон: ${phone.trim()}`);
  if (machineName.trim()) lines.push(`Техника: ${machineName.trim()}`);
  if (Number.isFinite(hours) && hours > 0) lines.push(`Часов: ${hours}`);
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
export function buildTelegramShareLink(pageUrl, text = '') {
  const params = new URLSearchParams({ url: pageUrl ?? '' });
  if (text) params.set('text', text);
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
    : buildTelegramShareLink(pageUrl, text);
}
