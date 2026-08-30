-- ============================================
-- FIX: Assinatura PIX mensal R$29 - dia 01, vence dia 06, trial até próximo 01
-- Antecipação 6 meses = R$174
-- ============================================

-- Tabela subscriptions (1 por store)
create table if not exists public.subscriptions (
  store_id uuid primary key references public.stores(id) on delete cascade,
  plan_amount numeric(10,2) not null default 29.00,
  status text not null default 'trial' check (status in ('trial','active','grace','past_due','blocked','canceled')),
  current_period_start date,
  current_period_end date not null, -- próximo vencimento (sempre dia 01)
  prepaid_until date, -- se antecipou 6 meses, ex: 2026-08-01
  trial_ends_at date,
  pix_qr text,
  pix_copy_paste text,
  mp_payment_id text,
  last_payment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela payments (histórico por competência YYYY-MM)
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  competence text not null, -- '2026-02'
  due_date date not null, -- 2026-02-01
  grace_until timestamptz not null, -- 2026-02-06 23:59:59
  amount numeric(10,2) not null, -- 29.00 ou 174.00
  status text not null default 'pending' check (status in ('pending','approved','overdue','canceled')),
  mp_payment_id text,
  mp_status text,
  pix_qr text,
  pix_copy_paste text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, competence)
);

create index if not exists idx_subscriptions_status on public.subscriptions(status);
create index if not exists idx_payments_store_competence on public.payments(store_id, competence);
create index if not exists idx_payments_due on public.payments(due_date, status);
create index if not exists idx_payments_grace on public.payments(grace_until, status);

-- Trigger updated_at
create or replace function public.update_subscriptions_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists update_subscriptions_updated_at on public.subscriptions;
create trigger update_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.update_subscriptions_updated_at();

drop trigger if exists update_payments_updated_at on public.payments;
create trigger update_payments_updated_at
  before update on public.payments
  for each row execute function public.update_updated_at_column();

-- Helper: próximo dia 01 (trial até lá)
create or replace function public.next_due_date(from_date date default current_date)
returns date language sql immutable as $$
  select (date_trunc('month', from_date::timestamp) + interval '1 month')::date
$$;

-- Garante assinatura trial ao criar loja (usar via trigger ou chamada manual)
create or replace function public.ensure_subscription(p_store_id uuid)
returns uuid language plpgsql as $$
declare v_due date; v_exists uuid;
begin
  select store_id into v_exists from public.subscriptions where store_id = p_store_id;
  if v_exists is not null then return v_exists; end if;
  v_due := public.next_due_date(current_date);
  insert into public.subscriptions (store_id, plan_amount, status, current_period_start, current_period_end, trial_ends_at)
  values (p_store_id, 29.00, 'trial', current_date, v_due, v_due)
  on conflict (store_id) do nothing;
  return p_store_id;
end; $$;

-- RLS
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

drop policy if exists "Owner can manage subscription" on public.subscriptions;
create policy "Owner can manage subscription"
  on public.subscriptions for all
  using (store_id in (select id from public.stores where owner_id = auth.uid()))
  with check (store_id in (select id from public.stores where owner_id = auth.uid()));

drop policy if exists "Staff can view subscription" on public.subscriptions;
create policy "Staff can view subscription"
  on public.subscriptions for select
  using (store_id in (select store_id from public.profiles where id = auth.uid()));

drop policy if exists "Owner can manage payments" on public.payments;
create policy "Owner can manage payments"
  on public.payments for all
  using (store_id in (select id from public.stores where owner_id = auth.uid()))
  with check (store_id in (select id from public.stores where owner_id = auth.uid()));

drop policy if exists "Staff can view payments" on public.payments;
create policy "Staff can view payments"
  on public.payments for select
  using (store_id in (select store_id from public.profiles where id = auth.uid()));

-- Para webhook service_role (bypass RLS) não precisa policy, mas para anon ler status público (bloqueio)
drop policy if exists "Public can check blocked status" on public.subscriptions;
create policy "Public can check blocked status"
  on public.subscriptions for select
  using (true);

comment on table public.subscriptions is 'Assinatura PIX R$29 dia 01, carência até 06, lembretes 03/05, antecipação 6x';
comment on column public.subscriptions.prepaid_until is 'Se antecipou 6 meses, ex: 2026-08-01 -> cron não gera até lá';
