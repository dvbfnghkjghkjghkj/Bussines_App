import { describe, expect, it } from 'vitest';
import {
  clearSession,
  cloudConfig,
  decodeTokenPayload,
  describeAccess,
  fetchPark,
  isSessionFresh,
  patchToRow,
  readSession,
  refreshSession,
  rowToPatch,
  rowsToOverrides,
  saveMachine,
  SESSION_STORAGE_KEY,
  signIn,
  writeSession,
} from '../../src/core/cloud.js';

const CLOUD = { url: 'https://demo.supabase.co', anonKey: 'anon-key', companyId: 'stroymash' };

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    dump: () => map,
  };
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

function recordingFetch(response, calls = []) {
  const impl = async (url, options = {}) => {
    calls.push({ url, options });
    return response;
  };
  return { impl, calls };
}

describe('cloudConfig', () => {
  it('без настроек возвращает null — страница живёт на конфиге', () => {
    expect(cloudConfig({})).toBeNull();
    expect(cloudConfig({ cloud: {} })).toBeNull();
    expect(cloudConfig({ cloud: { url: 'https://x.supabase.co', anonKey: '  ', companyId: 'a' } })).toBeNull();
  });

  it('требует company_id: без него неясно, чей парк показывать', () => {
    expect(cloudConfig({ cloud: { url: 'https://x.supabase.co', anonKey: 'key' } })).toBeNull();
    expect(cloudConfig({ cloud: { url: 'https://x.supabase.co', anonKey: 'key', companyId: ' ' } })).toBeNull();
  });

  it('чистит пробелы и хвостовой слэш', () => {
    expect(
      cloudConfig({ cloud: { url: ' https://x.supabase.co/ ', anonKey: ' key ', companyId: ' stroymash ' } }),
    ).toEqual({
      url: 'https://x.supabase.co',
      anonKey: 'key',
      companyId: 'stroymash',
    });
  });
});

describe('преобразование строк таблицы', () => {
  it('читает строку Supabase в правку', () => {
    expect(rowToPatch({ rate_per_hour: 3200.4, min_shift_hours: 4, status: 'busy' })).toEqual({
      ratePerHour: 3200,
      minShiftHours: 4,
      status: 'busy',
    });
  });

  it('отбрасывает мусор из строки', () => {
    expect(rowToPatch({ rate_per_hour: -5, min_shift_hours: 0, status: 'unknown' })).toEqual({});
  });

  it('собирает правки по парку', () => {
    const overrides = rowsToOverrides([
      { company_id: 'stroymash', id: 'mini-excavator', rate_per_hour: 2600, min_shift_hours: 4, status: 'available' },
      { id: '', rate_per_hour: 1 },
      { id: 'manipulator', status: 'confirm' },
    ]);

    expect(Object.keys(overrides)).toEqual(['mini-excavator', 'manipulator']);
    expect(overrides.manipulator).toEqual({ status: 'confirm' });
  });

  it('служебную колонку company_id не считает правкой', () => {
    expect(rowToPatch({ company_id: 'stroymash' })).toEqual({});
    expect(rowsToOverrides([{ company_id: 'stroymash', id: 'mini-excavator', status: 'busy' }])).toEqual({
      'mini-excavator': { status: 'busy' },
    });
  });

  it('пишет правку в snake_case и не отправляет пустоту', () => {
    expect(patchToRow({ ratePerHour: 3500, status: 'available' })).toEqual({
      rate_per_hour: 3500,
      status: 'available',
    });
    expect(patchToRow({ ratePerHour: -1 })).toEqual({});
  });
});

describe('fetchPark', () => {
  it('читает парк своей компании и передаёт её в заголовке', async () => {
    const { impl, calls } = recordingFetch(
      jsonResponse([{ id: 'wheel-loader', rate_per_hour: 3500, min_shift_hours: 4, status: 'available' }]),
    );

    const overrides = await fetchPark(CLOUD, impl);

    expect(calls[0].url).toBe(
      'https://demo.supabase.co/rest/v1/machines?select=id,rate_per_hour,min_shift_hours,status',
    );
    expect(calls[0].options.headers.apikey).toBe('anon-key');
    expect(calls[0].options.headers.Authorization).toBe('Bearer anon-key');
    expect(calls[0].options.headers['x-company-id']).toBe('stroymash');
    expect(overrides).toEqual({
      'wheel-loader': { ratePerHour: 3500, minShiftHours: 4, status: 'available' },
    });
  });

  it('падает с понятным текстом, если таблица закрыта', async () => {
    const { impl } = recordingFetch(
      jsonResponse({ message: 'permission denied for table machines' }, { ok: false, status: 401 }),
    );

    await expect(fetchPark(CLOUD, impl)).rejects.toThrow('permission denied for table machines');
  });
});

describe('saveMachine', () => {
  it('отправляет PATCH по id и возвращает сохранённое', async () => {
    const { impl, calls } = recordingFetch(
      jsonResponse([{ id: 'manipulator', rate_per_hour: 2900, min_shift_hours: 4, status: 'busy' }]),
    );

    const saved = await saveMachine(CLOUD, 'access-token', 'manipulator', {
      ratePerHour: 2900,
      status: 'busy',
    }, impl);

    expect(calls[0].url).toBe(
      'https://demo.supabase.co/rest/v1/machines?id=eq.manipulator&company_id=eq.stroymash',
    );
    expect(calls[0].options.method).toBe('PATCH');
    expect(calls[0].options.headers.Authorization).toBe('Bearer access-token');
    expect(calls[0].options.headers.Prefer).toBe('return=representation');
    expect(JSON.parse(calls[0].options.body)).toEqual({ rate_per_hour: 2900, status: 'busy' });
    expect(saved).toEqual({ ratePerHour: 2900, minShiftHours: 4, status: 'busy' });
  });

  it('не ходит в сеть без изменений', async () => {
    const { impl, calls } = recordingFetch(jsonResponse([]));
    const saved = await saveMachine(CLOUD, 'token', 'mini-excavator', {}, impl);

    expect(saved).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it('сообщает причину отказа', async () => {
    const { impl } = recordingFetch(
      jsonResponse({ message: 'new row violates row-level security policy' }, { ok: false, status: 403 }),
    );

    await expect(saveMachine(CLOUD, 'token', 'mini-excavator', { ratePerHour: 1 }, impl)).rejects.toThrow(
      'row-level security',
    );
  });

  it('не выдаёт пустой ответ за успех: RLS отфильтровала строку', async () => {
    const { impl } = recordingFetch(jsonResponse([]));

    await expect(saveMachine(CLOUD, 'token', 'mini-excavator', { ratePerHour: 2600 }, impl)).rejects.toThrow(
      'company_id',
    );
  });
});

describe('вход владельца', () => {
  it('обменивает e-mail и пароль на токен', async () => {
    const { impl, calls } = recordingFetch(
      jsonResponse({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        expires_in: 3600,
        user: { email: 'owner@stroymash.ru' },
      }),
    );

    const session = await signIn(CLOUD, 'owner@stroymash.ru', 'secret', impl);

    expect(calls[0].url).toBe('https://demo.supabase.co/auth/v1/token?grant_type=password');
    expect(calls[0].options.method).toBe('POST');
    expect(JSON.parse(calls[0].options.body)).toEqual({
      email: 'owner@stroymash.ru',
      password: 'secret',
    });
    expect(session.accessToken).toBe('access-1');
    expect(session.refreshToken).toBe('refresh-1');
    expect(session.email).toBe('owner@stroymash.ru');
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it('объясняет неверный пароль', async () => {
    const { impl } = recordingFetch(
      jsonResponse({ error_description: 'Invalid login credentials' }, { ok: false, status: 400 }),
    );

    await expect(signIn(CLOUD, 'owner@stroymash.ru', 'wrong', impl)).rejects.toThrow(
      'Invalid login credentials',
    );
  });

  it('продлевает сессию refresh-токеном', async () => {
    const { impl, calls } = recordingFetch(
      jsonResponse({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 60 }),
    );

    const session = await refreshSession(CLOUD, { refreshToken: 'refresh-1', email: 'a@b.c' }, impl);

    expect(calls[0].url).toBe('https://demo.supabase.co/auth/v1/token?grant_type=refresh_token');
    expect(session.accessToken).toBe('access-2');
    expect(session.email).toBe('a@b.c');
  });

  it('без refresh-токена просит войти заново', async () => {
    await expect(refreshSession(CLOUD, { accessToken: 'a' }, async () => jsonResponse({}))).rejects.toThrow(
      'войдите заново',
    );
  });
});

describe('сессия в localStorage', () => {
  it('сохраняется, читается и стирается', () => {
    const storage = memoryStorage();

    expect(readSession(storage)).toBeNull();

    writeSession(storage, { accessToken: 'a', refreshToken: 'r', expiresAt: 123, email: 'e@x' });
    expect(storage.dump().has(SESSION_STORAGE_KEY)).toBe(true);
    expect(readSession(storage)).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 123,
      email: 'e@x',
    });

    clearSession(storage);
    expect(readSession(storage)).toBeNull();
  });

  it('битые данные не роняют страницу', () => {
    const storage = memoryStorage();
    storage.setItem(SESSION_STORAGE_KEY, '{не json');
    expect(readSession(storage)).toBeNull();

    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ accessToken: '' }));
    expect(readSession(storage)).toBeNull();
  });

  it('считает токен свежим только с запасом до истечения', () => {
    const now = 1_000_000;

    expect(isSessionFresh({ accessToken: 'a', expiresAt: now + 30_000 }, now)).toBe(false);
    expect(isSessionFresh({ accessToken: 'a', expiresAt: now + 3_600_000 }, now)).toBe(true);
    expect(isSessionFresh(null, now)).toBe(false);
  });
});

describe('диагностика прав из токена', () => {
  const token = (payload) => `header.${globalThis.btoa(JSON.stringify(payload)).replace(/=+$/, '')}.signature`;

  it('читает payload JWT', () => {
    const payload = { email: 'owner@x.ru', role: 'authenticated', app_metadata: { company_id: 'stroymash' } };
    expect(decodeTokenPayload(token(payload))).toEqual(payload);
  });

  it('не падает на мусоре', () => {
    expect(decodeTokenPayload('нет-двух-точек')).toBeNull();
    expect(decodeTokenPayload('header.@@@.signature')).toBeNull();
    expect(decodeTokenPayload(null)).toBeNull();
  });

  it('показывает совпадение метки с конфигом', () => {
    const matches = describeAccess(
      { accessToken: token({ email: 'o@x.ru', role: 'authenticated', app_metadata: { company_id: 'stroymash' } }) },
      'stroymash',
    );
    expect(matches).toEqual({
      email: 'o@x.ru',
      role: 'authenticated',
      claim: 'stroymash',
      companyId: 'stroymash',
      matches: true,
    });
  });

  it('ловит отсутствующую или чужую метку', () => {
    const empty = describeAccess({ accessToken: token({ email: 'o@x.ru', role: 'authenticated' }) }, 'stroymash');
    expect(empty.claim).toBe('');
    expect(empty.matches).toBe(false);

    const other = describeAccess(
      { accessToken: token({ app_metadata: { company_id: 'barbershop-x' } }) },
      'stroymash',
    );
    expect(other.matches).toBe(false);
  });
});
