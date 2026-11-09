import './style.css';
import {
  canSelectStatus,
  company,
  findLevel,
  findMachine,
  findService,
  findZone,
  MACHINE_STATUS_LABELS,
  telegramUsername,
  templateOf,
} from './core/company.js';
import {
  formatDuration,
  formatHoursWord,
  formatPrice,
  formatServicePrice,
  orderTotal,
  priceForLevel,
} from './core/pricing.js';
import { buildBookingText, buildTelegramChatLink, pickTelegramLink } from './core/telegram.js';
import {
  clearOverrides,
  mergeMachines,
  parkStats,
  readOverrides,
  writeOverride,
} from './core/overrides.js';

const template = templateOf(company);
const isDemo = typeof __DEMO__ !== 'undefined' && __DEMO__;
const isNative = Boolean(window.Capacitor?.isNativePlatform?.());
const telegram = telegramUsername(company);

const storage = safeStorage();
let overrides = readOverrides(storage);
let machines = mergeMachines(company.machines ?? [], overrides);

const state = { requestText: '', selectedMachine: '' };
let noteTimer = 0;

const $ = (id) => document.getElementById(id);

init();

function init() {
  document.title = `${company.companyName} — ${company.tagline ?? company.kind ?? 'заявка'}`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta && company.tagline) meta.content = company.tagline;

  setText('company-name', company.companyName);
  setText('company-tagline', company.tagline ?? '');
  setText('hero-eyebrow', [company.kind, company.contacts?.workingHours].filter(Boolean).join(' · '));
  setText('hero-title', company.tagline || company.companyName);
  setText('hero-hours', company.heroNote ?? '');
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
  wireOwner();
  route();
  if (isDemo) applyDemoMode();
}

function applyTemplate() {
  const rental = template === 'rental';

  toggle('services-section', !rental);
  toggle('fleet-section', rental);
  toggle('owner-link', rental);
  document.querySelectorAll('.field--services').forEach((el) => {
    el.hidden = rental;
  });
  document.querySelectorAll('.field--rental').forEach((el) => {
    el.hidden = !rental;
  });

  const texts = company.texts ?? {};

  if (rental) {
    setText('hero-lead', texts.heroLead ?? buildRentalLead());
    setText('hero-cta', 'Рассчитать стоимость');
    setText('request-title', 'Расчёт аренды');
    setText('request-hint', texts.calcHint ?? 'Заполните параметры объекта — стоимость пересчитается автоматически.');
    setText('fleet-hint', texts.fleetHint ?? '');

    const comment = $('field-comment');
    if (comment) comment.placeholder = 'Что нужно сделать, детали объекта';

    if (!state.selectedMachine) {
      const first = machines.find((machine) => machine.status === 'available');
      if (first) state.selectedMachine = first.id;
    }

    renderFleet();
    updateSummary();
    return;
  }

  setText('hero-lead', buildServicesLead());
  setText('request-title', 'Запись');
  setText('request-hint', 'Оставьте контакты — подтвердим время в рабочее время барбершопа.');
  renderServices();
  updateSummary();
}

function buildRentalLead() {
  const count = machines.length;
  return `${count} ${plural(count, 'единица техники', 'единицы техники', 'единиц техники')} с почасовой оплатой. Цена предварительная — уточним под задачу.`;
}

function buildServicesLead() {
  const count = company.services?.length ?? 0;
  const levels = company.levels?.length ?? 0;
  const masters = levels > 0 ? `${levels} ${plural(levels, 'уровень мастера', 'уровня мастеров', 'уровней мастеров')}` : '';
  return `${count} ${plural(count, 'услуга', 'услуги', 'услуг')}, ${masters}. Точную цену и время подтвердим при записи.`;
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
      updateSummary();
      scrollToRequest();
    });
  });
}

// ---- аренда техники ----

function renderFleet() {
  const container = $('fleet');
  if (!container) return;

  container.innerHTML = machines
    .map((machine) => {
      const status = statusOf(machine);
      const selectable = canSelectStatus(status);
      const selected = machine.id === state.selectedMachine;
      const price = machine.ratePerHour > 0 ? `${formatPrice(machine.ratePerHour)}/час` : 'цена по запросу';
      const meta = `мин. смена — ${formatHoursWord(machine.minShiftHours)}`;
      const label = selected ? 'Техника выбрана' : selectable ? 'Выбрать' : 'Сейчас занята';

      return `
        <article class="card${selected ? ' card--selected' : ''}">
          <div class="card__media">
            ${machine.photo ? `<img src="${escapeAttr(machine.photo)}" alt="${escapeAttr(machine.name)}" loading="lazy" />` : ''}
            <span class="badge ${statusClass(status)}">${MACHINE_STATUS_LABELS[status]}</span>
          </div>
          <div class="card__body">
            <h3 class="card__title">${escapeHtml(machine.name)}</h3>
            <p class="card__purpose">${escapeHtml(machine.purpose ?? '')}</p>
            <p class="card__price">${escapeHtml(price)}</p>
            <p class="card__meta">${escapeHtml(meta)}</p>
            <button
              class="button button--small${selected ? ' button--selected' : ''}"
              type="button"
              data-machine="${escapeAttr(machine.id)}"
              ${selectable ? '' : 'disabled'}
            >${escapeHtml(label)}</button>
          </div>
        </article>`;
    })
    .join('');

  container.querySelectorAll('[data-machine]').forEach((button) => {
    button.addEventListener('click', () => {
      const machine = machines.find((item) => item.id === button.dataset.machine);
      if (!machine || !canSelectStatus(statusOf(machine))) return;
      state.selectedMachine = machine.id;
      const select = $('field-machine');
      if (select) select.value = machine.id;
      renderFleet();
      updateSummary();
      scrollToRequest();
    });
  });
}

// ---- форма и расчёт ----

function wireForm() {
  fillSelects();
  updateSummary();

  ['field-service', 'field-level', 'field-machine', 'field-zone'].forEach((id) => {
    $(id)?.addEventListener('change', updateSummary);
  });
  $('field-hours')?.addEventListener('input', updateSummary);
  $('field-photo')?.addEventListener('change', updateSummary);

  $('request-form')?.addEventListener('submit', onSubmit);
  $('copy-request')?.addEventListener('click', copyRequest);
  $('field-machine')?.addEventListener('change', () => {
    state.selectedMachine = $('field-machine').value;
    renderFleet();
  });
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
      ...machines.map((machine) => {
        const status = statusOf(machine);
        const suffix = status === 'busy' ? ' (занята)' : status === 'confirm' ? ' (подтверждение)' : '';
        return `<option value="${escapeAttr(machine.id)}"${canSelectStatus(status) ? '' : ' disabled'}>${escapeHtml(machine.name)} — ${escapeHtml(formatPrice(machine.ratePerHour))}/час${suffix}</option>`;
      }),
    ].join('');

    const fallback = machines.find((machine) => canSelectStatus(statusOf(machine)))?.id ?? '';
    const chosen = machines.some((machine) => machine.id === state.selectedMachine)
      ? state.selectedMachine
      : fallback;
    state.selectedMachine = chosen;
    machineSelect.value = chosen;
  }

  if (zoneSelect) {
    zoneSelect.innerHTML = [
      '<option value="">Без доставки</option>',
      ...(company.deliveryZones ?? []).map(
        (zone) =>
          `<option value="${escapeAttr(zone.id)}">${escapeHtml(zone.name)}${zone.price > 0 ? ` — ${escapeHtml(formatPrice(zone.price))}` : ' — бесплатно'}</option>`,
      ),
    ].join('');

    if (!zoneSelect.value) {
      zoneSelect.value = company.deliveryZones?.[0]?.id ?? '';
    }
  }
}

function updateSummary() {
  if (template !== 'rental') return updateServicesSummary();

  const rows = $('summary-rows');
  if (rows) rows.hidden = false;

  const machine = currentMachine();
  const zone = currentZone();
  const hours = Number($('field-hours')?.value ?? 0);
  const total = machine ? orderTotal({ machine, hours, zone }) : null;

  setText('summary-machine', machine ? `${machine.name} · ${formatPrice(machine.ratePerHour)}/час` : '—');
  setText('summary-hours', total ? formatHoursWord(total.hours) : '—');
  setText('summary-shift', total ? formatPrice(total.shift) : '—');
  setText('summary-delivery', zone && total ? `${formatPrice(total.delivery)} · ${zone.name}` : zone ? zone.name : 'не выбрана');
  setText('summary-total', total ? formatPrice(total.total) : '—');

  const note = $('summary-note');
  if (note) {
    if (total?.minApplied) {
      note.textContent = `Минимальная смена для этой техники — ${formatHoursWord(machine.minShiftHours)}. Расчёт выполнен с учётом минимальной смены.`;
      note.hidden = false;
    } else {
      note.hidden = true;
      note.textContent = '';
    }
  }

  const preview = $('price-preview');
  if (preview) {
    preview.textContent = total
      ? 'Предварительная стоимость. Точную сумму подтвердим после проверки адреса и даты.'
      : 'Выберите технику и количество часов — покажу расчёт.';
  }
}

function updateServicesSummary() {
  const rows = $('summary-rows');
  if (rows) rows.hidden = true;

  const service = currentService();
  const level = currentLevel();

  if (!service) {
    setText('summary-total', '—');
    setText('price-preview', 'Выберите услугу — покажу цену и длительность.');
    return;
  }

  const price = priceForLevel(service, level?.id);
  setText('summary-total', price === null ? 'цена по запросу' : formatPrice(price));
  setText('price-preview', price === null ? 'Точную стоимость подтвердим при записи.' : 'Предварительная стоимость, точную подтвердим при записи.');
}

function onSubmit(event) {
  event.preventDefault();
  clearError();

  const text = template === 'rental' ? buildRentalRequest() : buildServiceRequest();
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

function buildRentalRequest() {
  const machine = currentMachine();
  if (!machine) {
    showError('Выберите технику — без неё заявку не собрать.');
    return null;
  }

  const status = statusOf(machine);
  if (!canSelectStatus(status)) {
    showError('Эта техника занята. Выберите другую — перезвоним, как освободится.');
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
  const total = orderTotal({ machine, hours, zone });
  const when = formatRentalWhen($('field-date')?.value ?? '', $('field-time')?.value ?? '');
  const files = $('field-photo')?.files?.length ?? 0;

  return buildBookingText({
    title: status === 'confirm' ? 'Заявка (техника требует подтверждения)' : 'Заявка',
    companyName: company.companyName,
    machineName: machine.name,
    hours: formatHoursWord(total?.hours ?? hours),
    address,
    zoneName: zone?.name ?? '',
    when,
    priceText: total ? `предварительно ${formatPrice(total.total)}` : '',
    comment: $('field-comment')?.value.trim() ?? '',
    attachNote: files > 0 ? `${files} ${plural(files, 'файл', 'файла', 'файлов')} — приложу в чате` : '',
  });
}

function buildServiceRequest() {
  const name = $('field-name')?.value.trim() ?? '';
  const phone = $('field-phone')?.value.trim() ?? '';

  if (name.length < 2) {
    showError('Как к вам обращаться? Имя — хотя бы 2 буквы.');
    return null;
  }
  if (phone.replace(/\D/g, '').length < 10) {
    showError('Телефон должен содержать не меньше 10 цифр.');
    return null;
  }

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
    priceText: price === null ? '' : formatPrice(price),
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

// ---- панель владельца ----

function wireOwner() {
  $('owner-reset')?.addEventListener('click', () => {
    overrides = clearOverrides(storage);
    machines = mergeMachines(company.machines ?? [], overrides);
    renderOwner();
    renderFleet();
    updateSummary();
  });

  window.addEventListener('hashchange', route);
}

function route() {
  const owner = template === 'rental' && globalThis.location?.hash === '#owner';
  toggle('client-page', !owner);
  toggle('owner-page', owner);
  if (owner) renderOwner();
  window.scrollTo({ top: 0 });
}

function renderOwner() {
  const stats = parkStats(machines);
  const list = $('owner-stats');
  if (list) {
    list.innerHTML = [
      ['Свободны', stats.available],
      ['Заняты', stats.busy],
      ['Требуют подтверждения', stats.confirm],
      ['В парке', `${stats.total} ${plural(stats.total, 'единица техники', 'единицы техники', 'единиц техники')}`],
    ]
      .map(([label, value]) => `<li class="owner__stat"><span>${label}</span><strong>${value}</strong></li>`)
      .join('');
  }

  const grid = $('owner-machines');
  if (!grid) return;

  grid.innerHTML = machines
    .map(
      (machine) => `
      <article class="owner__card" data-owner-machine="${escapeAttr(machine.id)}">
        <h2 class="owner__card-title">${escapeHtml(machine.name)}</h2>
        <p class="owner__card-text">${escapeHtml(machine.purpose ?? '')}</p>
        <div class="owner__fields">
          <label class="owner__field">
            <span>Цена за час, ₽</span>
            <input type="number" min="0" step="100" value="${machine.ratePerHour}" data-field="ratePerHour" />
          </label>
          <label class="owner__field">
            <span>Минимальная смена, ч</span>
            <input type="number" min="1" step="1" value="${machine.minShiftHours}" data-field="minShiftHours" />
          </label>
          <label class="owner__field">
            <span>Статус техники</span>
            <select data-field="status">
              ${Object.entries(MACHINE_STATUS_LABELS)
                .map(
                  ([value, label]) =>
                    `<option value="${value}"${statusOf(machine) === value ? ' selected' : ''}>${label}</option>`,
                )
                .join('')}
            </select>
          </label>
        </div>
      </article>`,
    )
    .join('');

  grid.querySelectorAll('[data-owner-machine]').forEach((card) => {
    const id = card.dataset.ownerMachine;
    card.addEventListener('change', (event) => {
      const field = event.target?.dataset?.field;
      if (!field) return;
      const raw = event.target.value;
      const value = field === 'status' ? raw : Number(raw);
      saveOverride(id, { [field]: value });
    });
  });
}

function saveOverride(id, patch) {
  overrides = writeOverride(storage, id, patch);
  machines = mergeMachines(company.machines ?? [], overrides);

  const selected = machines.find((machine) => machine.id === state.selectedMachine);
  if (selected && !canSelectStatus(statusOf(selected))) {
    state.selectedMachine = machines.find((machine) => canSelectStatus(statusOf(machine)))?.id ?? '';
  }

  renderFleet();
  fillSelects();
  updateSummary();
  renderStats();
}

function renderStats() {
  const list = $('owner-stats');
  if (!list) return;
  const stats = parkStats(machines);
  list.innerHTML = [
    ['Свободны', stats.available],
    ['Заняты', stats.busy],
    ['Требуют подтверждения', stats.confirm],
    ['В парке', `${stats.total} ${plural(stats.total, 'единица техники', 'единицы техники', 'единиц техники')}`],
  ]
    .map(([label, value]) => `<li class="owner__stat"><span>${label}</span><strong>${value}</strong></li>`)
    .join('');
}

// ---- общее ----

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

function renderFind() {
  const list = $('find');
  if (!list) return;

  const contacts = company.contacts ?? {};
  const rows = [
    ['Адрес', contacts.address],
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

function currentService() {
  return findService($('field-service')?.value ?? '');
}

function currentLevel() {
  return findLevel($('field-level')?.value ?? '');
}

function currentMachine() {
  return findMachine($('field-machine')?.value ?? '', { machines });
}

function currentZone() {
  return findZone($('field-zone')?.value ?? '');
}

function statusOf(machine) {
  return machine?.status ?? 'available';
}

function statusClass(status) {
  if (status === 'busy') return 'badge--busy';
  if (status === 'confirm') return 'badge--warn';
  return 'badge--ok';
}

function showCopyButton(text) {
  const button = $('copy-request');
  if (!button || !text) return;
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

function formatRentalWhen(dateValue, timeValue) {
  const parts = [];
  if (dateValue) {
    const date = new Date(`${dateValue}T00:00`);
    parts.push(
      Number.isNaN(date.getTime())
        ? dateValue
        : new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date),
    );
  }
  if (timeValue) parts.push(timeValue);
  return parts.join(', ');
}

function scrollToRequest() {
  $('request')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
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
