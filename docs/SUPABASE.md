# Supabase: парк, который видят все

Страница остаётся статической, но панель владельца пишет цены и статусы в
Supabase. Клиент читает таблицу анонимным ключом при загрузке, поэтому правки
видны всем сразу — без пересборки и публикации.

Без заполненного блока `cloud` проект работает по-старому: настройки лежат в
`localStorage` браузера владельца (ADR-0012).

## 1. Проект в Supabase

1. Зарегистрироваться на [supabase.com](https://supabase.com) и создать проект
   (бесплатный тариф). Регион — ближайший, например Frankfurt.
2. Записать пароль базы в надёжное место: он нужен для админских задач.

## 2. Схема и политики

SQL Editor → New query → вставить целиком и нажать **Run**:

```sql
-- Парк техники: одна строка на машину из config/company.json
create table if not exists public.machines (
  id text primary key,
  rate_per_hour integer not null check (rate_per_hour >= 0),
  min_shift_hours integer not null check (min_shift_hours > 0),
  status text not null check (status in ('available', 'busy', 'confirm')),
  updated_at timestamptz not null default now()
);

alter table public.machines enable row level security;

-- Читать может кто угодно: это публичные цены на сайте
create policy "park: read for everyone"
  on public.machines for select
  to anon, authenticated
  using (true);

-- Писать может только вошедший владелец
create policy "park: write for owner"
  on public.machines for all
  to authenticated
  using (true)
  with check (true);

-- Стартовые значения совпадают с конфигом
insert into public.machines (id, rate_per_hour, min_shift_hours, status) values
  ('mini-excavator',    2500, 4, 'available'),
  ('crawler-excavator', 3800, 8, 'busy'),
  ('wheel-loader',      3200, 4, 'available'),
  ('manipulator',       2800, 4, 'confirm')
on conflict (id) do nothing;

-- Пометка времени правки
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists machines_touch_updated_at on public.machines;
create trigger machines_touch_updated_at
  before update on public.machines
  for each row execute function public.touch_updated_at();
```

Идентификаторы в `insert` должны совпадать с `machines[].id` в
`config/company.json` — по ним же идёт запись.

## 3. Владелец

Authentication → Users → **Add user**:

- e-mail владельца, пароль;
- включить **Auto Confirm User** (иначе Supabase ждёт письма, а почту в
  проекте настраивать не обязательно).

Регистрация в интерфейсе не нужна: пользователь создаётся вручную, в панели он
просто входит по этим данным.

## 4. Ключи в конфиг

Project Settings → API:

- **Project URL** → `cloud.url`
- **anon public** → `cloud.anonKey`

```json
"cloud": {
  "url": "https://xxxxxxxx.supabase.co",
  "anonKey": "eyJhbGciOi..."
}
```

`anonKey` — публичный ключ, он и так уезжает в браузер. Защита держится на RLS:
без входа запись отклоняется. **Пароль владельца в конфиг не попадает.**

После заполнения: `npm run build` (или `npm run build:demo`) и публикация как
обычно.

## 5. Проверка

1. Открыть `#owner` — появится форма входа.
2. Войти e-mail и паролем владельца.
3. Поменять цену «Фронтальный погрузчик» на 3500 — сообщение
   «Сохранено в облаке».
4. Открыть сайт в другом браузере или на телефоне: в карточке 3 500 ₽/час,
   итог пересчитан.

## Как это устроено

- `src/core/cloud.js` — четыре запроса обычным `fetch`, без SDK:
  вход, продление сессии, чтение парка, PATCH одной машины.
- Токен входа живёт час и лежит в `localStorage`; перед записью он продлевается
  refresh-токеном.
- `localStorage` остаётся кэшем: если облако недоступно, страница показывает
  последние сохранённые значения и данные из конфига.
- Сброс «вернуть значения из конфига» в облачном режиме скрыт: откат делает
  владелец вручную в SQL Editor или в панели.

## Ограничения

- Правки видны клиентам после перезагрузки страницы — realtime не подключён.
- Нужен интернет: полностью офлайн (ПК-приложение без сети) работает только
  локальный режим.
- Это отступление от ТЗ кейса («без сервера и БД»), решение записано в
  `docs/DECISIONS.md` (ADR-0013).
