/**
 * Настройки парка из панели владельца.
 *
 * Сервера в проекте нет, поэтому правки живут в localStorage браузера
 * владельца: он меняет цены и статусы у себя, а данные страницы
 * (config/company.json) остаются неизменными. Для реального продакшена
 * это ограничение известно и описано в docs/DECISIONS.md (ADR-0012).
 */

import { MACHINE_STATUSES } from './company.js';

export const PARK_STORAGE_KEY = 'stroymash:park:v1';

/** Хранилище по умолчанию; в тестах подменяется Map-объектом. */
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Читает сохранённые правки. Битые данные не роняют страницу —
 * возвращается пустой объект, то есть значения из конфига.
 */
export function readOverrides(storage = defaultStorage()) {
  if (!storage) return {};

  let parsed;
  try {
    const raw = storage.getItem(PARK_STORAGE_KEY);
    if (!raw) return {};
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const clean = {};
  for (const [id, value] of Object.entries(parsed)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    const entry = {};
    if (Number.isFinite(value.ratePerHour) && value.ratePerHour >= 0) {
      entry.ratePerHour = Math.round(value.ratePerHour);
    }
    if (Number.isFinite(value.minShiftHours) && value.minShiftHours > 0) {
      entry.minShiftHours = Math.round(value.minShiftHours);
    }
    if (MACHINE_STATUSES.includes(value.status)) {
      entry.status = value.status;
    }
    if (Object.keys(entry).length > 0) clean[id] = entry;
  }

  return clean;
}

/** Сохраняет правку одной машины; пустые/битые значения отбрасываются. */
export function writeOverride(storage, machineId, patch = {}) {
  if (!storage) return {};
  const next = { ...readOverrides(storage) };
  const entry = { ...(next[machineId] ?? {}) };

  if (Number.isFinite(patch.ratePerHour) && patch.ratePerHour >= 0) {
    entry.ratePerHour = Math.round(patch.ratePerHour);
  }
  if (Number.isFinite(patch.minShiftHours) && patch.minShiftHours > 0) {
    entry.minShiftHours = Math.round(patch.minShiftHours);
  }
  if (MACHINE_STATUSES.includes(patch.status)) {
    entry.status = patch.status;
  }

  if (Object.keys(entry).length > 0) next[machineId] = entry;
  else delete next[machineId];

  storage.setItem(PARK_STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** Сбрасывает все правки — возвращает данные из конфига. */
export function clearOverrides(storage = defaultStorage()) {
  if (!storage) return {};
  storage.removeItem(PARK_STORAGE_KEY);
  return {};
}

/** Накладывает правки владельца на технику из конфига. */
export function mergeMachines(machines = [], overrides = {}) {
  return machines.map((machine) => {
    const patch = overrides[machine.id];
    if (!patch) return machine;
    return {
      ...machine,
      ratePerHour: patch.ratePerHour ?? machine.ratePerHour,
      minShiftHours: patch.minShiftHours ?? machine.minShiftHours,
      status: patch.status ?? machine.status ?? 'available',
    };
  });
}

/** Сводка по парку для панели владельца. */
export function parkStats(machines = []) {
  const stats = { available: 0, busy: 0, confirm: 0, total: machines.length };
  for (const machine of machines) {
    const status = MACHINE_STATUSES.includes(machine.status) ? machine.status : 'available';
    stats[status] += 1;
  }
  return stats;
}
