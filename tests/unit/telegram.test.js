import { describe, expect, it } from 'vitest';
import {
  buildRequestText,
  buildTelegramChatLink,
  buildTelegramDeepLink,
  buildTelegramShareLink,
  normalizeUsername,
  pickTelegramLink,
} from '../../src/core/telegram.js';

describe('normalizeUsername', () => {
  it('снимает собаку', () => {
    expect(normalizeUsername('@company')).toBe('company');
  });

  it('снимает ссылку t.me и хвостовой слэш', () => {
    expect(normalizeUsername('https://t.me/company/')).toBe('company');
  });

  it('на пустом значении отдаёт пустую строку', () => {
    expect(normalizeUsername(undefined)).toBe('');
    expect(normalizeUsername('   ')).toBe('');
  });
});

describe('buildRequestText', () => {
  it('собирает все заполненные поля', () => {
    const text = buildRequestText({
      name: 'Анна',
      phone: '+7 900 000-00-00',
      machineName: 'Экскаватор',
      hours: 6,
      comment: 'Центр города',
    });

    expect(text).toContain('Имя: Анна');
    expect(text).toContain('Телефон: +7 900 000-00-00');
    expect(text).toContain('Техника: Экскаватор');
    expect(text).toContain('Часов: 6');
    expect(text).toContain('Комментарий: Центр города');
  });

  it('не выводит пустые строки и служебные undefined', () => {
    const text = buildRequestText({ name: 'Анна' });
    expect(text).not.toContain('Телефон:');
    expect(text).not.toContain('undefined');
  });

  it('подставляет заглушку, если полей нет совсем', () => {
    expect(buildRequestText({})).toContain('Пользователь не заполнил поля.');
  });

  it('обрезает пробелы по краям', () => {
    expect(buildRequestText({ name: '  Анна  ' })).toContain('Имя: Анна');
  });
});

describe('ссылки Telegram', () => {
  it('строит deep link с закодированным текстом', () => {
    const link = buildTelegramDeepLink('@company', 'Привет, мир');
    expect(link.startsWith('tg://resolve?')).toBe(true);

    const params = new URLSearchParams(link.split('?')[1]);
    expect(params.get('domain')).toBe('company');
    expect(params.get('text')).toBe('Привет, мир');
  });

  it('без текста deep link всё равно рабочий', () => {
    expect(buildTelegramDeepLink('company')).toBe('tg://resolve?domain=company');
  });

  it('возвращает null без ника', () => {
    expect(buildTelegramDeepLink('')).toBeNull();
    expect(buildTelegramDeepLink('   ')).toBeNull();
  });

  it('строит веб-ссылку на чат', () => {
    expect(buildTelegramChatLink('@company')).toBe('https://t.me/company');
    expect(buildTelegramChatLink('')).toBeNull();
  });

  it('строит share-ссылку с текстом и адресом страницы', () => {
    const link = buildTelegramShareLink('https://example.com', 'Заявка');
    const params = new URLSearchParams(link.split('?')[1]);
    expect(params.get('url')).toBe('https://example.com');
    expect(params.get('text')).toBe('Заявка');
  });
});

describe('pickTelegramLink', () => {
  it('в APK отдаёт tg://, в браузере — share-ссылку', () => {
    const native = pickTelegramLink({ username: 'company', text: 'Заявка', isNative: true });
    const web = pickTelegramLink({ username: 'company', text: 'Заявка', pageUrl: 'https://example.com' });

    expect(native.startsWith('tg://')).toBe(true);
    expect(web.startsWith('https://t.me/share/url')).toBe(true);
  });

  it('без ника не отдаёт ссылку ни на одной платформе', () => {
    expect(pickTelegramLink({ username: '', isNative: true })).toBeNull();
    expect(pickTelegramLink({ username: '', isNative: false })).toBeNull();
  });
});
