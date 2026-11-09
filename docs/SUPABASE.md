# Supabase: один проект на всех клиентов

Статическая страница читает парк из облака, панель владельца пишет туда же.
Один проект Supabase обслуживает сколько угодно компаний: строки разделены
колонкой `company_id`, а RLS не даёт увидеть или изменить чужие цены.

Без заполненного блока `cloud` проект работает по-старому: правки живут в
`localStorage` браузера владельца (ADR-0012).

## Как разделяются клиенты

- сайт компании отправляет заголовок `x-company-id: stroymash`;
- политика **чтения** отдаёт строки, у которых `company_id` совпадает с
  заголовком, — клиент видит только свой парк;
- политика **записи** разрешает вошедшему пользователю менять только строки
  своей компании: `company_id` берётся из метки пользователя
  (`app_metadata.company_id`), а не из запроса.

Подделать заголовок клиент может, но это даёт лишь чтение чужих цен, которые
и так опубликованы на чужом сайте. Записи без входа и без метки не будет.

## 1. Схема (один раз на проект)

SQL Editor → New query → вставить и **Run**:

```sql
drop table if exists public.machines cascade;

create table public.machines (
  company_id text not null,
  id text not null,
  rate_per_hour integer not null check (rate_per_hour >= 0),
  min_shift_hours integer not null check (min_shift_hours > 0),
  status text not null check (status in ('available', 'busy', 'confirm')),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);

alter table public.machines enable row level security;

-- Чтение: только строки компании из заголовка x-company-id
create policy "park: read own company"
  on public.machines for select
  to anon, authenticated
  using (
    company_id = (
      nullif(current_setting('request.headers', true), '')::json ->> 'x-company-id'
    )
  );

-- Запись: только владелец, у которого в app_metadata тот же company_id
create policy "park: write own company"
  on public.machines for all
  to authenticated
  using (company_id = coalesce(auth.jwt() -> 'app_metadata' ->> 'company_id', ''))
  with check (company_id = coalesce(auth.jwt() -> 'app_metadata' ->> 'company_id', ''));

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

-- Первый клиент: СТРОЙМАШ
insert into public.machines (company_id, id, rate_per_hour, min_shift_hours, status) values
  ('stroymash', 'mini-excavator',    2500, 4, 'available'),
  ('stroymash', 'crawler-excavator', 3800, 8, 'busy'),
  ('stroymash', 'wheel-loader',      3200, 4, 'available'),
  ('stroymash', 'manipulator',       2800, 4, 'confirm');
```

`drop table` в начале — потому что таблица от первой версии (без `company_id`)
данных клиентов не содержит. Когда появятся реальные заказчики, вместо него
пишут `alter table ... add column company_id text not null default ...`.

## 2. Ключи в конфиг

Project Settings → API Keys → **Publishable key** (или `anon` из вкладки
Legacy). Кладём в `config/company.json`:

```json
"cloud": {
  "url": "https://xxxxxxxx.supabase.co",
  "anonKey": "sb_publishable_...",
  "companyId": "stroymash"
}
```

`anonKey` публичный — он и так уезжает в браузер, защита держится на RLS.
Пароль владельца в конфиг не попадает никогда.

## 3. Подключить нового клиента

Три шага, все в дашборде Supabase:

1. **Строки парка** — SQL Editor:

   ```sql
   insert into public.machines (company_id, id, rate_per_hour, min_shift_hours, status) values
     ('barbershop-x', 'machine-1', 2000, 4, 'available');
   ```

   `id` машин должны совпадать с `machines[].id` в конфиге клиента.

2. **Пользователь владельца** — Authentication → Users → Add user:
   e-mail, пароль, **Auto Confirm User**.

3. **Метка компании** — у этого пользователя открыть **User metadata**
   (raw app metadata) и добавить:

   ```json
   { "company_id": "barbershop-x" }
   ```

   Без метки владелец войдёт, но не сможет сохранить правки — политика
   отклонит запись.

4. В конфиге клиента указать `cloud.companyId = "barbershop-x"` и
   опубликовать сайт.

Один проект, один e-mail владельца на компанию, отдельные строки в базе.

## 4. Проверка

1. Открыть `#owner` → форма входа.
2. Войти e-mail и паролем владельца.
3. Поменять цену → «Сохранено в облаке».
4. Открыть сайт в другом браузере: цена новая.
5. Подставить в конфиг чужой `companyId` — цены чужой компании не появятся.

## Как устроено в коде

- `src/core/cloud.js` — вход, продление сессии, чтение парка, PATCH одной
  машины; всё обычным `fetch`, без SDK.
- Заголовок `x-company-id` добавляется к каждому запросу.
- Токен живёт час, продлевается refresh-токеном перед записью.
- `localStorage` остаётся кэшем и резервом: если облако недоступно, страница
  показывает конфиг и последние сохранённые значения.

## Ограничения

- Правки видны клиентам после перезагрузки страницы — realtime не подключён.
- Нужен интернет; офлайн работает только локальный режим.
- Это отступление от ТЗ кейса («без сервера и БД»), см. ADR-0013 и ADR-0014.
