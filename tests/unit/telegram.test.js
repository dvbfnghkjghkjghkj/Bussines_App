import { describe, expect, it } from 'vitest';
import {
  buildBookingText,
  buildTelegramChatLink,
  buildTelegramDeepLink,
  buildTelegramShareLink,
  normalizeUsername,
  pickTelegramLink,
} from '../../src/core/telegram.js';

describe('normalizeUsername', () => {
  it('понимает ник с собакой', () => {
    expect(normalizeUsername('@Cuba691')).toBe('Cuba691');
  });

  it('понимает голый ник', () => {
    expect(normalizeUsername('Cuba691')).toBe('Cuba691');
  });

  it('понимает ссылку t.me', () => {
    expect(normalizeUsername('https://t.me/Cuba691')).toBe('Cuba691');
    expect(normalizeUsername('t.me/Cuba691/?start=1')).toBe('Cuba691');
  });

  it('отбрасывает не-никообразное', () => {
    expect(normalizeUsername('')).toBe('');
    expect(normalizeUsername('ab')).toBe('');
    expect(normalizeUsername('+7 910 930-55-55')).toBe('');
    expect(normalizeUsername('три слова')).toBe('');
  });
});

describe('buildBookingText', () => {
  it('собирает все заполненные поля', () => {
    const text = buildBookingText({
      companyName: 'OldBoy',
      name: 'Иван',
      phone: '+7 910 930-55-55',
      serviceName: 'Мужская стрижка',
      levelName: 'ТОП барбер',
      when: '10.11.2026, 14:30',
      priceText: '1 800 ₽',
      comment: 'Хочу к мастеру с бородой',
    });

    expect(text).toContain('Запись — OldBoy');
    expect(text).toContain('Имя: Иван');
    expect(text).toContain('Телефон: +7 910 930-55-55');
    expect(text).toContain('Услуга: Мужская стрижка');
    expect(text).toContain('Мастер: ТОП барбер');
    expect(text).toContain('Когда: 10.11.2026, 14:30');
    expect(text).toContain('Цена: 1 800 ₽');
    expect(text).toContain('Комментарий: Хочу к мастеру с бородой');
  });

  it('не добавляет пустые поля', () => {
    const text = buildBookingText({ companyName: 'OldBoy', name: 'Иван' });
    expect(text).not.toContain('Телефон:');
    expect(text).not.toContain('Услуга:');
    expect(text).not.toContain('undefined');
  });

  it('предупреждает, если ничего не заполнено', () => {
    expect(buildBookingText()).toContain('Пользователь не заполнил поля.');
  });
});

describe('ссылки Telegram', () => {
  it('deep link ведёт в конкретный чат', () => {
    const link = buildTelegramDeepLink('@Cuba691', 'Привет');
    expect(link).toContain('tg://resolve?');
    expect(link).toContain('domain=Cuba691');
    expect(link).toContain('text=');
  });

  it('deep link без ника не строится', () => {
    expect(buildTelegramDeepLink('', 'Привет')).toBeNull();
  });

  it('ссылка на чат', () => {
    expect(buildTelegramChatLink('@Cuba691')).toBe('https://t.me/Cuba691');
    expect(buildTelegramChatLink('')).toBeNull();
  });

  it('share-ссылка кодирует текст', () => {
    const link = buildTelegramShareLink('Запись\nИмя: Иван', 'https://example.com');
    expect(link).toContain('https://t.me/share/url?');
    // URLSearchParams кодирует пробел как «+».
    expect(decodeURIComponent(link.replaceAll('+', ' '))).toContain('Имя: Иван');
  });

  it('pickTelegramLink выбирает deep link для APK', () => {
    expect(pickTelegramLink({ username: '@Cuba691', text: 'Запись', isNative: true })).toContain(
      'tg://resolve',
    );
  });

  it('pickTelegramLink выбирает share для браузера', () => {
    expect(
      pickTelegramLink({ username: '@Cuba691', text: 'Запись', pageUrl: 'https://x.dev', isNative: false }),
    ).toContain('t.me/share/url');
  });

  it('pickTelegramLink молчит без ника', () => {
    expect(pickTelegramLink({ username: '', text: 'Запись' })).toBeNull();
  });
});
