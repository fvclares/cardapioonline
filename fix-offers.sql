-- ============================================
-- MOTOR DE OFERTAS POR REGRAS - Combos/Promoções
-- Fase 0: base genérica (price fechado + grupos + schedules)
-- ============================================

-- Helpers existentes já em supabase-schema.sql: update_updated_at_column()

-- TABELA: offers (oferta/combo/promoção por regras)
create table if not exists public.offers (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  active boolean not null default true,
  max_per_order int check (max_per_order is null or max_per_order >= 1),
  display_order int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_offers_store on public.offers(store_id);
create index if not exists idx_offers_store_active on public.offers(store_id, active);
drop trigger if exists update_offers_updated_at on public.offers;
create trigger update_offers_updated_at before update on public.offers for each row execute function update_updated_at_column();

-- TABELA: offer_groups (grupos de seleção da oferta)
create table if not exists public.offer_groups (
  id uuid primary key default uuid_generate_v4(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  name text not null, -- ex: "Escolha 4 salgadas"
  quantity int not null check (quantity >= 1),
  display_order int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists idx_offer_groups_offer on public.offer_groups(offer_id);

-- TABELA: offer_group_items (itens permitidos por grupo + adicional)
create table if not exists public.offer_group_items (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.offer_groups(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  extra_price numeric(10,2) not null default 0, -- adicional dentro do combo (ex: Camarão +15)
  created_at timestamptz not null default now(),
  unique(group_id, product_id)
);
create index if not exists idx_offer_group_items_group on public.offer_group_items(group_id);
create index if not exists idx_offer_group_items_product on public.offer_group_items(product_id);

-- TABELA: offer_schedules (janela temporal, vazio = sempre ativo)
create table if not exists public.offer_schedules (
  id uuid primary key default uuid_generate_v4(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0=dom 1=seg ... 6=sab
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_offer_schedules_offer on public.offer_schedules(offer_id);

-- RLS
alter table public.offers enable row level security;
alter table public.offer_groups enable row level security;
alter table public.offer_group_items enable row level security;
alter table public.offer_schedules enable row level security;

-- Policies: Store members can manage
drop policy if exists "Store members can manage offers" on public.offers;
create policy "Store members can manage offers" on public.offers for all using (
  store_id in (select id from public.stores where owner_id = auth.uid() union select store_id from public.profiles where id = auth.uid())
) with check (
  store_id in (select id from public.stores where owner_id = auth.uid() union select store_id from public.profiles where id = auth.uid())
);
drop policy if exists "Public can view active offers" on public.offers;
create policy "Public can view active offers" on public.offers for select using (
  active = true and store_id in (select id from public.stores where status='open')
);

drop policy if exists "Store members can manage offer_groups" on public.offer_groups;
create policy "Store members can manage offer_groups" on public.offer_groups for all using (
  offer_id in (select id from public.offers where store_id in (select id from public.stores where owner_id = auth.uid() union select store_id from public.profiles where id = auth.uid()))
) with check (
  offer_id in (select id from public.offers where store_id in (select id from public.stores where owner_id = auth.uid() union select store_id from public.profiles where id = auth.uid()))
);
drop policy if exists "Public can view offer_groups" on public.offer_groups;
create policy "Public can view offer_groups" on public.offer_groups for select using (
  offer_id in (select id from public.offers where active=true and store_id in (select id from public.stores where status='open'))
);

drop policy if exists "Store members can manage offer_group_items" on public.offer_group_items;
create policy "Store members can manage offer_group_items" on public.offer_group_items for all using (
  group_id in (select id from public.offer_groups where offer_id in (select id from public.offers where store_id in (select id from public.stores where owner_id = auth.uid() union select store_id from public.profiles where id = auth.uid())))
) with check (
  group_id in (select id from public.offer_groups where offer_id in (select id from public.offers where store_id in (select id from public.stores where owner_id = auth.uid() union select store_id from public.profiles where id = auth.uid())))
);
drop policy if exists "Public can view offer_group_items" on public.offer_group_items;
create policy "Public can view offer_group_items" on public.offer_group_items for select using (
  group_id in (select id from public.offer_groups where offer_id in (select id from public.offers where active=true and store_id in (select id from public.stores where status='open')))
);

drop policy if exists "Store members can manage offer_schedules" on public.offer_schedules;
create policy "Store members can manage offer_schedules" on public.offer_schedules for all using (
  offer_id in (select id from public.offers where store_id in (select id from public.stores where owner_id = auth.uid() union select store_id from public.profiles where id = auth.uid()))
) with check (
  offer_id in (select id from public.offers where store_id in (select id from public.stores where owner_id = auth.uid() union select store_id from public.profiles where id = auth.uid()))
);
drop policy if exists "Public can view offer_schedules" on public.offer_schedules;
create policy "Public can view offer_schedules" on public.offer_schedules for select using (
  offer_id in (select id from public.offers where active=true and store_id in (select id from public.stores where status='open'))
);

-- View opcional: oferta completa (útil para debug)
create or replace view public.v_offers_full as
select o.*, json_agg(distinct jsonb_build_object('id', g.id, 'name', g.name, 'quantity', g.quantity)) as groups
from public.offers o left join public.offer_groups g on g.offer_id=o.id group by o.id;
