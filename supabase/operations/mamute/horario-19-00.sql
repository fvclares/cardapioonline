-- Pizzaria Mamute — horário de funcionamento 19:00 às 00:00, fechado às segundas.
-- Idempotente (só toca o campo schedule). Rode no SQL Editor (postgres, sem RLS).
-- Dias vazios ou com "closed" contam como fechado; 00:00 de fechamento cobre até 23:59.
insert into public.store_settings(store_id, schedule)
values ('a5f88e35-f150-4c37-a7bd-2220e02ad2c8',
  '{"hasLunchClosure": false,
    "seg": {"closed": true},
    "ter": {"open": "19:00", "close": "00:00"},
    "qua": {"open": "19:00", "close": "00:00"},
    "qui": {"open": "19:00", "close": "00:00"},
    "sex": {"open": "19:00", "close": "00:00"},
    "sab": {"open": "19:00", "close": "00:00"},
    "dom": {"open": "19:00", "close": "00:00"}}'::jsonb)
on conflict(store_id) do update set schedule=excluded.schedule, updated_at=now();
-- Conferência
select schedule from public.store_settings where store_id='a5f88e35-f150-4c37-a7bd-2220e02ad2c8';
