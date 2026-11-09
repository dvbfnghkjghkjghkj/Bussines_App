/**
 * Облако Supabase: парк техники хранится в таблице `machines`, клиенты читают
 * её анонимным ключом, а писать может только владелец после входа по e-mail
 * и паролю (RLS-политика «только authenticated»). Схема и политики —
 * в docs/SUPABASE.md.
 *
 * SDK не тянем: нужны четыре запроса, обычного fetch хватает, и бандл
 * не растёт на сотни килобайт ради PATCH одной строки.
 */

import { MACHINE_STATUSES } from './company.js';

export const SESSION_STORAGE_KEY = 'stroymash:owner-session:v1';

/** Запас перед истечением токена, чтобы не отправлять запрос «в последний миг». */
const REFRESH_MARGIN_MS = 60_000;

/**
 * Достаёт настройки облака из конфига. Пустые строки — это «облако не
 * подключено», страница работает от конфига и localStorage.
 */
export function cloudConfig(company = {}) {
  const cloud = company?.cloud;
  if (!cloud || typeof cloud !== 'object' || Array.isArray(cloud)) return null;

  const url = typeof cloud.url === 'string' ? cloud.url.trim().replace(/\/+$/, '') : '';
  const anonKey = typeof cloud.anonKey === 'string' ? cloud.anonKey.trim() : '';
  if (!url || !anonKey) return null;

  return { url, anonKey };
}

// ---- преобразование строк таблицы ----

/** Строка Supabase → правка в форме, привычной остальному коду. */
export function rowToPatch(row = {}) {
  const patch = {};
  if (Number.isFinite(row.rate_per_hour) && row.rate_per_hour >= 0) {
    patch.ratePerHour = Math.round(row.rate_per_hour);
  }
  if (Number.isFinite(row.min_shift_hours) && row.min_shift_hours > 0) {
    patch.minShiftHours = Math.round(row.min_shift_hours);
  }
  if (MACHINE_STATUSES.includes(row.status)) patch.status = row.status;
  return patch;
}

/** Список строк → объект правок по id машины. */
export function rowsToOverrides(rows = []) {
  const overrides = {};
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id) continue;
    const patch = rowToPatch(row);
    if (Object.keys(patch).length > 0) overrides[row.id] = patch;
  }
  return overrides;
}

/** Правка → тело запроса в Supabase (snake_case, без пустых полей). */
export function patchToRow(patch = {}) {
  const row = {};
  if (Number.isFinite(patch.ratePerHour) && patch.ratePerHour >= 0) {
    row.rate_per_hour = Math.round(patch.ratePerHour);
  }
  if (Number.isFinite(patch.minShiftHours) && patch.minShiftHours > 0) {
    row.min_shift_hours = Math.round(patch.minShiftHours);
  }
  if (MACHINE_STATUSES.includes(patch.status)) row.status = patch.status;
  return row;
}

// ---- сессия владельца ----

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Читает сессию владельца; битые данные считаются «не вошёл». */
export function readSession(storage = defaultStorage()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.accessToken !== 'string' || !parsed.accessToken) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : '',
      expiresAt: Number.isFinite(parsed.expiresAt) ? parsed.expiresAt : 0,
      email: typeof parsed.email === 'string' ? parsed.email : '',
    };
  } catch {
    return null;
  }
}

export function writeSession(storage, session) {
  if (!storage || !session?.accessToken) return null;
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearSession(storage = defaultStorage()) {
  if (!storage) return;
  storage.removeItem(SESSION_STORAGE_KEY);
}

/** Токен ещё жив (с запасом), значит вход не нужен. */
export function isSessionFresh(session, now = Date.now()) {
  if (!session?.accessToken) return false;
  if (!session.expiresAt) return false;
  return session.expiresAt - REFRESH_MARGIN_MS > now;
}

// ---- запросы ----

async function errorMessage(response) {
  try {
    const data = await response.json();
    const raw = data?.msg ?? data?.message ?? data?.error_description ?? data?.error ?? '';
    return typeof raw === 'string' && raw ? raw : `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

function baseHeaders(cloud, token) {
  return {
    apikey: cloud.anonKey,
    Authorization: `Bearer ${token ?? cloud.anonKey}`,
    Accept: 'application/json',
  };
}

/** Вход владельца по e-mail и паролю. */
export async function signIn(cloud, email, password, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(`${cloud.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { ...baseHeaders(cloud), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) throw new Error(await errorMessage(response));

  const data = await response.json();
  return {
    accessToken: data.access_token ?? '',
    refreshToken: data.refresh_token ?? '',
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    email: data.user?.email ?? email,
  };
}

/** Продлевает сессию, чтобы владельцу не приходилось входить каждый час. */
export async function refreshSession(cloud, session, fetchImpl = globalThis.fetch) {
  if (!session?.refreshToken) throw new Error('Сессия истекла, войдите заново.');

  const response = await fetchImpl(`${cloud.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { ...baseHeaders(cloud), 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });

  if (!response.ok) throw new Error(await errorMessage(response));

  const data = await response.json();
  return {
    accessToken: data.access_token ?? '',
    refreshToken: data.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    email: data.user?.email ?? session.email,
  };
}

/** Публичное чтение парка — анонимный ключ, без входа. */
export async function fetchPark(cloud, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(
    `${cloud.url}/rest/v1/machines?select=id,rate_per_hour,min_shift_hours,status`,
    { headers: baseHeaders(cloud) },
  );

  if (!response.ok) throw new Error(await errorMessage(response));

  const rows = await response.json();
  return rowsToOverrides(Array.isArray(rows) ? rows : []);
}

/** Запись правки владельцем: PATCH одной строки, нужен токен входа. */
export async function saveMachine(cloud, accessToken, machineId, patch, fetchImpl = globalThis.fetch) {
  const body = patchToRow(patch);
  if (Object.keys(body).length === 0) return {};

  const response = await fetchImpl(
    `${cloud.url}/rest/v1/machines?id=eq.${encodeURIComponent(machineId)}`,
    {
      method: 'PATCH',
      headers: {
        ...baseHeaders(cloud, accessToken),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) throw new Error(await errorMessage(response));

  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return patchToPatchFallback(patch);
  return rowToPatch(row);
}

function patchToPatchFallback(patch) {
  return rowToPatch(patchToRow(patch));
}
