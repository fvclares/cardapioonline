-- ============================================
-- PIZZA SIZES + PRICES POR PRODUTO
-- Execute no SQL Editor do Supabase
-- ============================================

-- Tamanhos definidos pela loja (P, M, G, Família...)
create table if not exists public.pizza_sizes (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null, -- ex: P, M, G, Família
  slices int not null default 8,
  max_flavors int not null default 1 check (max_flavors between 1 and 4),
  display_order int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_pizza_sizes_store on public.pizza_sizes(store_id);
create index if not exists idx_pizza_sizes_store_order on public.pizza_sizes(store_id, display_order);

-- Preço por pizza/tamanho
create table if not exists public.product_size_prices (
  product_id uuid not null references public.products(id) on delete cascade,
  size_id uuid not null references public.pizza_sizes(id) on delete cascade,
  price numeric(10,2) not null check (price >= 0),
  primary key (product_id, size_id)
);
create index if not exists idx_product_size_prices_product on public.product_size_prices(product_id);
create index if not exists idx_product_size_prices_size on public.product_size_prices(size_id);

-- RLS
alter table public.pizza_sizes enable row level security;
alter table public.product_size_prices enable row level security;

-- Pizza sizes: membros da loja gerenciam, público vê ativas de loja aberta
drop policy if exists "Store members can manage pizza_sizes" on public.pizza_sizes;
create policy "Store members can manage pizza_sizes" on public.pizza_sizes for all
  using (store_id in (select id from public.stores where owner_id=auth.uid() union select store_id from public.profiles where id=auth.uid()))
  with check (store_id in (select id from public.stores where owner_id=auth.uid() union select store_id from public.profiles where id=auth.uid()));

drop policy if exists "Public can view active pizza_sizes" on public.pizza_sizes;
create policy "Public can view active pizza_sizes" on public.pizza_sizes for select
  using (is_active=true and store_id in (select id from public.stores where status='open'));

-- Product size prices: via pizza_sizes store
drop policy if exists "Store members can manage product_size_prices" on public.product_size_prices;
create policy "Store members can manage product_size_prices" on public.product_size_prices for all
  using (size_id in (select id from public.pizza_sizes where store_id in (select id from public.stores where owner_id=auth.uid() union select store_id from public.profiles where id=auth.uid())))
  with check (size_id in (select id from public.pizza_sizes where store_id in (select id from public.stores where owner_id=auth.uid() union select store_id from public.profiles where id=auth.uid())));

drop policy if exists "Public can view product_size_prices" on public.product_size_prices;
create policy "Public can view product_size_prices" on public.product_size_prices for select
  using (size_id in (select id from public.pizza_sizes where store_id in (select id from public.stores where status='open')));

-- Seed opcional: tamanhos padrão para lojas existentes sem tamanhos
-- Descomente se quiser criar P/M/G/Família para todas as lojas
-- insert into public.pizza_sizes (store_id, name, slices, max_flavors, display_order)
-- select id, 'M (6 fatias)', 6, 1, 1 from public.stores where id not in (select store_id from public.pizza_sizes)
-- union all select id, 'G (8 fatias)', 8, 2, 2 from public.stores where id not in (select store_id from public.pizza_sizes)
-- union all select id, 'Família (12 fatias)', 12, 4, 3 from public.stores where id not in (select store_id from public.pizza_sizes);
