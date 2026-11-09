import './style.css';
import { getCompany, findMachine, telegramUsername } from './core/company.js';
import { calcShiftPrice, formatHours, formatPrice } from './core/pricing.js';
import { buildRequestText, pickTelegramLink, buildTelegramChatLink } from './core/telegram.js';

const company = getCompany();
const isNative = Boolean(window.Capacitor?.isNativePlatform?.());
const isDemo = typeof __DEMO__ !== 'undefined' && __DEMO__;
const currency = '₽';

const $ = (id) => document.getElementById(id);

init();

function init() {
  document.title = `${company.companyName} — заявка`;
  setText('company-name', company.companyName);
  setText('company-tagline', company.tagline ?? '');
  setText('hero-title', company.tagline || company.companyName);
  setText('hero-lead', buildHeroLead());
  setText('hero-hours', company.contacts?.workingHours ?? '');
  setText('footer-name', company.companyName);
  setText('footer-address', company.contacts?.address ?? '');
  setText('footer-hours', company.contacts?.workingHours ?? '');

  const phone = company.contacts?.phone ?? '';
  ['header-phone', 'footer-phone'].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.textContent = phone;
    el.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
  });

  renderLogo();
  renderMachines();
  renderZones();
  renderTelegramLinks();
  wireForm();
  if (isDemo) applyDemoMode();
}

function buildHeroLead() {
  const count = company.machines.length;
  return `${count} ${plural(count, 'единица техники', 'единицы техники', 'единиц техники')} с почасовой оплатой. Цена предварительная — уточним под задачу.`;
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

function renderMachines() {
  const container = $('machines');
  if (!container) return;

  container.innerHTML = company.machines
    .map((machine) => {
      const price = machine.ratePerHour > 0 ? `от ${formatPrice(machine.ratePerHour, currency)}/ч` : 'цена по запросу';
      const minShift = machine.minShiftHours ? `Минимальная смена — ${formatHours(machine.minShiftHours)}` : '';
      const status = machine.status === 'available' ? 'Свободна' : 'Занята';
      const statusClass = machine.status === 'available' ? 'badge badge--ok' : 'badge';

      return `
        <article class="card">
          <div class="card__media">
            ${machine.photo ? `<img src="${escapeAttr(machine.photo)}" alt="${escapeAttr(machine.name)}" loading="lazy" />` : ''}
            <span class="${statusClass}">${status}</span>
          </div>
          <div class="card__body">
            <h3 class="card__title">${escapeHtml(machine.name)}</h3>
            <p class="card__purpose">${escapeHtml(machine.purpose ?? '')}</p>
            <p class="card__price">${price}</p>
            <p class="card__meta">${escapeHtml([minShift, machine.delivery].filter(Boolean).join(' · '))}</p>
            <button class="button button--small" type="button" data-machine="${escapeAttr(machine.id)}">
              Выбрать
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
      $('request')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const select = $('field-machine');
  if (select) {
    select.innerHTML = company.machines
      .map((machine) => `<option value="${escapeAttr(machine.id)}">${escapeHtml(machine.name)}</option>`)
      .join('');
  }
}

function renderZones() {
  const zones = company.deliveryZones ?? [];
  const section = $('zones-section');
  const list = $('zones');
  if (!section || !list || zones.length === 0) return;

  section.hidden = false;
  list.innerHTML = zones
    .map((zone) => {
      const price = zone.price > 0 ? formatPrice(zone.price, currency) : 'бесплатно';
      const freeFrom = zone.freeFrom > 0 ? `, бесплатно от ${formatPrice(zone.freeFrom, currency)}` : '';
      return `<li class="zone"><span>${escapeHtml(zone.name)}</span><span class="zone__price">${price}${freeFrom}</span></li>`;
    })
    .join('');
}

function renderTelegramLinks() {
  const username = telegramUsername(company.contacts ?? {});
  const link = $('hero-telegram');
  if (!link) return;

  if (!username) {
    link.hidden = true;
    return;
  }
  link.href = buildTelegramChatLink(username);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
}

function wireForm() {
  const form = $('request-form');
  const hoursInput = $('field-hours');
  if (!form || !hoursInput) return;

  hoursInput.addEventListener('input', updatePricePreview);
  $('field-machine')?.addEventListener('change', updatePricePreview);
  updatePricePreview();

  $('copy-request')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(buildRequestTextFromForm());
      flashNote('Заявка скопирована — вставьте её в чат Telegram.');
    } catch {
      flashNote('Не удалось скопировать. Выделите текст заявки вручную.');
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (isDemo) {
      flashNote('Это демо-версия: заявки не отправляются.');
      return;
    }
    const error = validateForm();
    const errorBox = $('form-error');
    if (errorBox) {
      errorBox.textContent = error ?? '';
      errorBox.hidden = !error;
    }
    if (error) return;

    const username = telegramUsername(company.contacts ?? {});
    const text = buildRequestTextFromForm();
    const link = pickTelegramLink({
      username,
      text,
      pageUrl: window.location.href,
      isNative,
    });

    if (!link) {
      flashNote('Контакт Telegram не настроен — скопируйте заявку и отправьте её вручную.');
      revealCopyButton();
      return;
    }

    window.location.href = link;
    // если через секунду страница всё ещё видна — Telegram не открылся
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        flashNote('Telegram не открылся. Скопируйте заявку и отправьте её вручную.');
        revealCopyButton();
      }
    }, 1500);
  });
}

function revealCopyButton() {
  const button = $('copy-request');
  if (button) button.hidden = false;
}

/**
 * Демо-режим: та же страница с данными клиента, но заявки не уходят,
 * а сверху висит плашка — чтобы демо не приняли за рабочую версию.
 */
function applyDemoMode() {
  document.body.classList.add('is-demo');

  const banner = document.createElement('div');
  banner.className = 'demo-banner';
  banner.setAttribute('role', 'status');
  banner.textContent = 'Демо-версия: данные примерные, заявки не отправляются';
  document.body.prepend(banner);

  const telegram = $('hero-telegram');
  if (telegram) telegram.hidden = true;

  const submit = document.querySelector('#request-form button[type="submit"]');
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Отправка в демо недоступна';
    submit.title = 'Демо-версия: форма не отправляет заявки';
  }

  const note = $('form-note');
  if (note) note.textContent = 'Это демо-версия: заполните форму, чтобы оценить сценарий, но заявка не уйдёт.';
}

function updatePricePreview() {
  const preview = $('price-preview');
  const select = $('field-machine');
  if (!preview || !select) return;

  const machine = findMachine(select.value, company);
  const hours = Number($('field-hours')?.value ?? 0);
  if (!machine) {
    preview.textContent = '';
    return;
  }

  if (!Number.isFinite(hours) || hours <= 0) {
    preview.textContent = `Минимальная смена — ${formatHours(machine.minShiftHours)}.`;
    return;
  }

  const billedHours = Math.max(hours, machine.minShiftHours);
  const price = calcShiftPrice({
    ratePerHour: machine.ratePerHour,
    hours,
    minShiftHours: machine.minShiftHours,
  });

  preview.textContent =
    machine.ratePerHour > 0
      ? `Предварительно: ${formatPrice(price, currency)} за ${formatHours(billedHours)}`
      : 'Цена по запросу: посчитаем после уточнения задачи.';
}

function buildRequestTextFromForm() {
  const select = $('field-machine');
  const machine = findMachine(select?.value ?? '', company);
  return buildRequestText({
    name: $('field-name')?.value ?? '',
    phone: $('field-phone')?.value ?? '',
    machineName: machine?.name ?? '',
    hours: Number($('field-hours')?.value ?? 0),
    comment: $('field-comment')?.value ?? '',
  });
}

function validateForm() {
  const name = $('field-name')?.value.trim() ?? '';
  const phone = $('field-phone')?.value.trim() ?? '';
  if (name.length < 2) return 'Укажите имя — хотя бы две буквы.';
  if (phone.replace(/\D/g, '').length < 10) return 'Укажите телефон в формате +7 ___ ___-__-__.';
  return null;
}

let noteTimer;
function flashNote(message) {
  const note = $('form-note');
  if (!note) return;
  note.textContent = message;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    note.textContent = '';
  }, 6000);
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
