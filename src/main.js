import './style.css';
import { getCompany, telegramUsername, templateOf } from './core/company.js';
import {
  formatDuration,
  formatHours,
  formatPrice,
  formatPriceRange,
  formatServicePrice,
  orderPriceRange,
  priceForLevel,
} from './core/pricing.js';
import { buildBookingText, buildTelegramChatLink, pickTelegramLink } from './core/telegram.js';

const company = getCompany();
const template = templateOf(company);
const isNative = Boolean(window.Capacitor?.isNativePlatform?.());
const isDemo = typeof __DEMO__ !== 'undefined' && __DEMO__;
const telegram = telegramUsername(company);

const $ = (id) => document.getElementById(id);
const state = { requestText: '' };
let noteTimer = 0;

init();

function init() {
  document.title = `${company.companyName} — ${company.kind ?? 'заявка'}`;
  setText('company-name', company.companyName);
  setText('company-tagline', company.tagline ?? '');
  setText('hero-eyebrow', [company.kind, company.contacts?.workingHours].filter(Boolean).join(' · '));
  setText('hero-title', company.tagline || company.companyName);
  setText('hero-lead', buildHeroLead());
  setText('hero-hours', [company.contacts?.address, company.contacts?.entrance].filter(Boolean).join(' · '));
  setText('footer-name', company.companyName);
  setText('footer-address', company.contacts?.address ?? '');
  setText('footer-hours', company.contacts?.workingHours ?? '');

  renderPhone();
  renderLogo();
  renderPromo();
  renderFind();
  applyTemplate();
  renderTelegramLinks();
  wireForm();
  if (isDemo) applyDemoMode();
}

function buildHeroLead() {
  if (template === 'rental') {
    const count = company.machines?.length ?? 0;
    return `${count} ${plural(count, 'единица техники', 'единицы техники', 'единиц техники')} с почасовой оплатой. Цена предварительная — уточним под задачу.`;
  }

  const count = company.services?.length ?? 0;
  const levels = company.levels?.length ?? 0;
  const masters = levels > 0 ? `${levels} ${plural(levels, 'уровень мастера', 'уровня мастеров', 'уровней мастеров')}` : '';
  return `${count} ${plural(count, 'услуга', 'услуги', 'услуг')}, ${masters}. Точную цену и время подтвердим при записи.`;
}

function applyTemplate() {
  toggle('services-section', template === 'services');
  toggle('fleet-section', template === 'rental');
  toggle('zones-section', template === 'rental' && (company.deliveryZones?.length ?? 0) > 0);

  document.querySelectorAll('.field--services').forEach((el) => {
    el.hidden = template !== 'services';
  });
  document.querySelectorAll('.field--rental').forEach((el) => {
    el.hidden = template !== 'rental';
  });

  if (template === 'rental') {
    setText('hero-cta', 'Оставить заявку');
    setText('request-title', 'Заявка');
    setText('request-hint', 'Укажите технику, адрес и часы — подтвердим стоимость и время подачи.');

    const comment = $('field-comment');
    if (comment) comment.placeholder = 'Что нужно сделать, подъезд, детали';
  }

  if (template === 'services') renderServices();
  else renderFleet();
}

function renderPhone() {
  const phone = company.contacts?.phone ?? '';
  ['header-phone', 'footer-phone'].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.textContent = phone;
    el.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
  });

  const map = $('footer-map');
  if (map) {
    if (company.contacts?.mapUrl) map.href = company.contacts.mapUrl;
    else map.hidden = true;
  }
}

function renderLogo() {
  const logo = $('logo');
  if (!logo) return;
  if (company.logo) {
    logo.src = company.logo;
    logo.alt = company.companyName;
  } else {
    logo.hidden = true;
  }
}

function renderPromo() {
  const promo = company.promo;
  const box = $('promo');
  if (!box || !promo?.title) return;
  setText('promo-title', promo.title);
  setText('promo-text', promo.text ?? '');
  box.hidden = false;
}

// ---- услуги ----

function renderServices() {
  const container = $('services');
  if (!container) return;

  container.innerHTML = (company.services ?? [])
    .map((service) => {
      const price = formatServicePrice(service);
      const duration = service.duration ? formatDuration(service.duration) : '';
      const meta = [duration, service.note].filter(Boolean).join(' · ');

      return `
        <article class="card">
          <div class="card__body">
            <h3 class="card__title">${escapeHtml(service.name)}</h3>
            <p class="card__price">${escapeHtml(price)}</p>
            <p class="card__meta">${escapeHtml(meta)}</p>
            <button class="button button--small" type="button" data-service="${escapeAttr(service.id)}">
              Записаться
            </button>
          </div>
        </article>`;
    })
    .join('');

  container.querySelectorAll('[data-service]').forEach((button) => {
    button.addEventListener('click', () => {
      const select = $('field-service');
      if (select) select.value = button.dataset.service;
      updatePricePreview();
      scrollToRequest();
    });
  });
}

// ---- аренда техники ----

function renderFleet() {
  const container = $('fleet');
  if (!container) return;

  container.innerHTML = (company.machines ?? [])
    .map((machine) => {
      const available = machine.status !== 'busy';
      const price = machine.ratePerHour > 0 ? `от ${formatPrice(machine.ratePerHour)}/ч` : 'цена по запросу';
      const minShift = machine.minShiftHours ? `Смена от ${formatHours(machine.minShiftHours)}` : '';
      const meta = [minShift, machine.delivery].filter(Boolean).join(' · ');

      return `
        <article class="card">
          <div class="card__media">
            ${machine.photo ? `<img src="${escapeAttr(machine.photo)}" alt="${escapeAttr(machine.name)}" loading="lazy" />` : ''}
            <span class="badge ${available ? 'badge--ok' : ''}">${available ? 'Свободна' : 'Занята'}</span>
          </div>
          <div class="card__body">
            <h3 class="card__title">${escapeHtml(machine.name)}</h3>
            <p class="card__purpose">${escapeHtml(machine.purpose ?? '')}</p>
            <p class="card__price">${escapeHtml(price)}</p>
            <p class="card__meta">${escapeHtml(meta)}</p>
            <button class="button button--small" type="button" data-machine="${escapeAttr(machine.id)}" ${available ? '' : 'disabled'}>
              ${available ? 'Выбрать' : 'Занята'}
            </button>
          </div>
        </article>`;
    })
    .join('');

  container.querySelectorAll('[data-machine]').forEach((button) => {
    button.addEventListener('click', () => {
      const select = $('field-machine');
      if (select) select.value = button.dataset.machine;
      updatePricePreview();
      scrollToRequest();
    });
  });

  renderZones();
}

function renderZones() {
  const list = $('zones');
  if (!list) return;

  const zones = company.deliveryZones ?? [];
  list.innerHTML = zones
    .map((zone) => {
      const price = zone.price > 0 ? formatPrice(zone.price) : 'бесплатно';
      const free = zone.freeFrom > 0 ? `Бесплатно от ${formatPrice(zone.freeFrom)}` : '';
      const meta = [free, zone.note].filter(Boolean).join(' · ');

      return `
        <li class="zone">
          <span class="zone__name">${escapeHtml(zone.name)}</span>
          <span class="zone__value">${escapeHtml([price, meta].filter(Boolean).join(' · '))}</span>
        </li>`;
    })
    .join('');
}

// ---- общее ----

function renderFind() {
  const list = $('find');
  if (!list) return;

  const contacts = company.contacts ?? {};
  const rows = [
    ['Адрес', contacts.address],
    ['Вход', contacts.entrance],
    ['Часы работы', contacts.workingHours],
    ['Телефон', contacts.phone],
  ].filter(([, value]) => value);

  list.innerHTML = rows
    .map(
      ([label, value]) => `
      <li class="zone">
        <span class="zone__name">${escapeHtml(label)}</span>
        <span class="zone__value">${escapeHtml(value)}</span>
      </li>`,
    )
    .join('');
}

function renderTelegramLinks() {
  const link = $('hero-telegram');
  if (!link) return;

  const chat = buildTelegramChatLink(telegram);
  if (!chat || isDemo) {
    link.hidden = true;
    return;
  }

  link.href = chat;
  link.target = '_blank';
  link.rel = 'noopener';
  link.hidden = false;
}

function wireForm() {
  fillSelects();
  updatePricePreview();

  ['field-service', 'field-level', 'field-machine', 'field-zone'].forEach((id) => {
    $(id)?.addEventListener('change', updatePricePreview);
  });
  $('field-hours')?.addEventListener('input', updatePricePreview);

  $('request-form')?.addEventListener('submit', onSubmit);
  $('copy-request')?.addEventListener('click', copyRequest);
}

function fillSelects() {
  const serviceSelect = $('field-service');
  const levelSelect = $('field-level');
  const machineSelect = $('field-machine');
  const zoneSelect = $('field-zone');

  if (serviceSelect) {
    serviceSelect.innerHTML = [
      '<option value="">Выберите услугу</option>',
      ...(company.services ?? []).map(
        (service) =>
          `<option value="${escapeAttr(service.id)}">${escapeHtml(service.name)} — ${escapeHtml(formatServicePrice(service))}</option>`,
      ),
    ].join('');
  }

  if (levelSelect) {
    levelSelect.innerHTML = (company.levels ?? [])
      .map(
        (level, index) =>
          `<option value="${escapeAttr(level.id)}"${index === 0 ? ' selected' : ''}>${escapeHtml(level.name)}</option>`,
      )
      .join('');
  }

  if (machineSelect) {
    machineSelect.innerHTML = [
      '<option value="">Выберите технику</option>',
      ...(company.machines ?? []).map(
        (machine) =>
          `<option value="${escapeAttr(machine.id)}"${machine.status === 'busy' ? ' disabled' : ''}>${escapeHtml(machine.name)} — от ${escapeHtml(formatPrice(machine.ratePerHour))}/ч${machine.status === 'busy' ? ' (занята)' : ''}</option>`,
      ),
    ].join('');
  }

  if (zoneSelect) {
    zoneSelect.innerHTML = [
      '<option value="">Без доставки</option>',
      ...(company.deliveryZones ?? []).map(
        (zone) =>
          `<option value="${escapeAttr(zone.id)}"${zone.price > 0 ? '' : ' selected'}>${escapeHtml(zone.name)} — ${zone.price > 0 ? escapeHtml(formatPrice(zone.price)) : 'бесплатно'}</option>`,
      ),
    ].join('');
  }
}

function updatePricePreview() {
  const preview = $('price-preview');
  if (!preview) return;

  if (template === 'rental') {
    const machine = currentMachine();
    if (!machine) {
      preview.textContent = 'Выберите технику — покажу предварительную стоимость.';
      return;
    }

    const hours = Number($('field-hours')?.value ?? 0);
    const zone = currentZone();
    const range = orderPriceRange({ machine, hours, zone });
    const parts = [machine.name, `смена от ${formatHours(machine.minShiftHours)}`];

    if (range) parts.push(`предварительно ${formatPriceRange(range.min, range.max)}`);
    if (zone && zone.price > 0) parts.push(`доставка: ${zone.name}`);

    preview.textContent = parts.filter(Boolean).join(' · ');
    return;
  }

  const service = currentService();
  if (!service) {
    preview.textContent = 'Выберите услугу — покажу цену и длительность.';
    return;
  }

  const level = currentLevel();
  const price = priceForLevel(service, level?.id);
  const parts = [level?.name, price === null ? 'цена по запросу' : formatPrice(price)];

  if (service.duration) parts.push(formatDuration(service.duration));
  if (service.note) parts.push(service.note);

  preview.textContent = `${service.name}: ${parts.filter(Boolean).join(' · ')}`;
}

function onSubmit(event) {
  event.preventDefault();
  clearError();

  const name = $('field-name')?.value.trim() ?? '';
  const phone = $('field-phone')?.value.trim() ?? '';

  if (name.length < 2) return showError('Как к вам обращаться? Имя — хотя бы 2 буквы.');
  if (phone.replace(/\D/g, '').length < 10) return showError('Телефон должен содержать не меньше 10 цифр.');

  const text = template === 'rental' ? buildRentalRequest({ name, phone }) : buildServiceRequest({ name, phone });
  if (!text) return;

  state.requestText = text;
  showCopyButton(text);

  if (isDemo) {
    flashNote('Демо: заявка не отправляется, но текст можно скопировать.');
    return;
  }

  const link = pickTelegramLink({ username: telegram, text, isNative });

  if (!link) {
    flashNote('Telegram не настроен — скопируйте заявку и отправьте вручную.');
    return;
  }

  if (isNative) {
    globalThis.location.href = link;
  } else {
    window.open(link, '_blank', 'noopener');
  }
  flashNote('Telegram открыт: проверьте текст и нажмите «Отправить» — заявка уйдёт владельцу.');
}

function buildServiceRequest({ name, phone }) {
  const service = currentService();
  if (!service) {
    showError('Выберите услугу — от неё зависит цена и длительность.');
    return null;
  }

  const level = currentLevel();
  const price = priceForLevel(service, level?.id);

  return buildBookingText({
    title: 'Запись',
    companyName: company.companyName,
    name,
    phone,
    serviceName: service.name,
    levelName: level?.name ?? '',
    when: formatWhen($('field-when')?.value ?? ''),
    priceText: price === null ? '' : `${formatPrice(price)}${service.note ? ` (${service.note})` : ''}`,
    comment: $('field-comment')?.value.trim() ?? '',
  });
}

function buildRentalRequest({ name, phone }) {
  const machine = currentMachine();
  if (!machine) {
    showError('Выберите технику — без неё заявку не собрать.');
    return null;
  }

  const hours = Number($('field-hours')?.value ?? 0);
  if (!Number.isFinite(hours) || hours < 1) {
    showError('Укажите количество часов — хотя бы 1.');
    return null;
  }

  const address = $('field-address')?.value.trim() ?? '';
  if (address.length < 5) {
    showError('Нужен адрес объекта: куда подавать технику.');
    return null;
  }

  const zone = currentZone();
  const range = orderPriceRange({ machine, hours, zone });
  const priceText = range ? `предварительно ${formatPriceRange(range.min, range.max)}` : '';

  return buildBookingText({
    companyName: company.companyName,
    name,
    phone,
    machineName: machine.name,
    hours,
    address,
    zoneName: zone?.name ?? '',
    when: formatWhen($('field-when')?.value ?? ''),
    priceText,
    comment: $('field-comment')?.value.trim() ?? '',
  });
}

async function copyRequest() {
  if (!state.requestText) return;
  try {
    await navigator.clipboard.writeText(state.requestText);
    flashNote('Заявка скопирована в буфер обмена.');
  } catch {
    flashNote('Не удалось скопировать — выделите текст вручную.');
  }
}

function currentService() {
  const id = $('field-service')?.value;
  if (!id) return null;
  return (company.services ?? []).find((service) => service.id === id) ?? null;
}

function currentLevel() {
  const id = $('field-level')?.value;
  if (!id) return null;
  return (company.levels ?? []).find((level) => level.id === id) ?? null;
}

function currentMachine() {
  const id = $('field-machine')?.value;
  if (!id) return null;
  return (company.machines ?? []).find((machine) => machine.id === id) ?? null;
}

function currentZone() {
  const id = $('field-zone')?.value;
  if (!id) return null;
  return (company.deliveryZones ?? []).find((zone) => zone.id === id) ?? null;
}

function showCopyButton(text) {
  const button = $('copy-request');
  if (!button || !text || isDemo) return;
  button.hidden = false;
}

function applyDemoMode() {
  const banner = document.createElement('div');
  banner.className = 'demo-banner';
  banner.textContent = 'Демо-версия: заявки не отправляются, кнопки записи отключены.';
  document.body.prepend(banner);

  const submit = document.querySelector('#request-form button[type="submit"]');
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Отправка в демо недоступна';
  }

  const copy = $('copy-request');
  if (copy) copy.hidden = false;
}

function showError(message) {
  const box = $('form-error');
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
}

function clearError() {
  const box = $('form-error');
  if (!box) return;
  box.textContent = '';
  box.hidden = true;
}

function flashNote(message) {
  const note = $('form-note');
  if (!note) return;
  note.textContent = message;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    note.textContent = '';
  }, 6000);
}

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function scrollToRequest() {
  $('request')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('field-name')?.focus({ preventScroll: true });
}

function toggle(id, visible) {
  const el = $(id);
  if (el) el.hidden = !visible;
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function plural(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
