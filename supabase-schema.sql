-- ============================================
-- SUPABASE SCHEMA - CARDÁPIO ONLINE SAAS
-- Multi-tenant (pizzarias) com RLS
-- Execute no SQL Editor do Supabase
-- ============================================

-- Extensões necessárias
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================
-- FUNCTION: update_updated_at_column()
-- ============================================
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================
-- TABELA: stores (pizzarias/tenants)
-- ============================================
create table public.stores (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,                    -- URL amigável: bella-massa
  name text not null,                           -- Nome da pizzaria
  phone text not null,                          -- WhatsApp para pedidos
  phone_display text,                           -- Formato exibição: (11) 99999-8888
  description text,
  logo_url text,
  cover_url text,
  address text,
  opening_hours text,
  status text not null default 'open' check (status in ('open', 'closed')),
  default_delivery_fee numeric(10,2) default 7.00,
  min_order_value numeric(10,2) default 35.00,
  settings jsonb default '{}'::jsonb,           -- Configurações extras (cores, tema, etc)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_stores_owner on public.stores(owner_id);
create index idx_stores_slug on public.stores(slug);

-- Trigger para updated_at
create trigger update_stores_updated_at
  before update on public.stores
  for each row execute function update_updated_at_column();

-- ============================================
-- TABELA: profiles (usuários do sistema)
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  store_id uuid references public.stores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_store on public.profiles(store_id);

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function update_updated_at_column();

-- ============================================
-- TABELA: categories (categorias do cardápio)
-- ============================================
create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,                           -- Ex: "🍕 Pizzas Tradicionais"
  display_order int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_categories_store on public.categories(store_id);
create index idx_categories_store_order on public.categories(store_id, display_order);

create trigger update_categories_updated_at
  before update on public.categories
  for each row execute function update_updated_at_column();

-- ============================================
-- TABELA: products (produtos do cardápio)
-- ============================================
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  description text,
  base_price numeric(10,2) not null,
  image_url text,
  is_pizza boolean not null default false,
  has_crusts boolean not null default true,
  has_extras boolean not null default true,
  available boolean not null default true,
  display_order int not null default 1,
  codigo int check (codigo between 1 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_store on public.products(store_id);
create index idx_products_category on public.products(category_id);
create index idx_products_store_available on public.products(store_id, available);
create index idx_products_store_category_order on public.products(store_id, category_id, display_order);
create unique index idx_products_store_codigo on public.products(store_id, codigo) where codigo is not null;

create trigger update_products_updated_at
  before update on public.products
  for each row execute function update_updated_at_column();

-- ============================================
-- TABELA: addon_groups (grupos de opcionais: tamanhos, bordas, extras)
-- ============================================
create table public.addon_groups (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,                           -- Ex: "Escolha o Tamanho"
  title text not null,                          -- Ex: "Tamanho da Pizza"
  type text not null check (type in ('single', 'multiple')), -- radio ou checkbox
  required boolean not null default false,
  applies_to text[] default '{}',               -- ['pizza', 'calzone'] ou vazio = todos
  display_order int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_addon_groups_store on public.addon_groups(store_id);

create trigger update_addon_groups_updated_at
  before update on public.addon_groups
  for each row execute function update_updated_at_column();

-- ============================================
-- TABELA: addon_options (opções dentro de cada grupo)
-- ============================================
create table public.addon_options (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.addon_groups(id) on delete cascade,
  name text not null,                           -- Ex: "Grande (8 fatias)"
  price_diff numeric(10,2) not null default 0,  -- Diferença de preço (pode ser negativo)
  allows_half_half boolean not null default false, -- Para pizzas meio a meio
  is_default boolean not null default false,
  display_order int not null default 1,
  created_at timestamptz not null default now()
);

create index idx_addon_options_group on public.addon_options(group_id);
create index idx_addon_options_group_order on public.addon_options(group_id, display_order);

-- ============================================
-- TABELA: neighborhoods (bairros de entrega com taxa)
-- ============================================
create table public.neighborhoods (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  delivery_fee numeric(10,2) not null default 0,
  is_active boolean not null default true,
  display_order int not null default 1,
  created_at timestamptz not null default now()
);

create index idx_neighborhoods_store on public.neighborhoods(store_id);

-- ============================================
-- TABELA: orders (pedidos)
-- ============================================
create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_number text not null,                   -- Ex: "PDV-2024001"
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  customer_address jsonb,                       -- {street, number, complement, neighborhood, reference}
  order_type text not null check (order_type in ('delivery', 'pickup')),
  items jsonb not null,                         -- Array de itens com opcionais
  subtotal numeric(10,2) not null,
  delivery_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  payment_method text not null check (payment_method in ('pix', 'card', 'cash', 'online')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  status text not null default 'received' check (status in ('received', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled')),
  notes text,                                   -- Observações do cliente
  whatsapp_sent boolean not null default false,
  whatsapp_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_orders_store on public.orders(store_id);
create index idx_orders_store_created on public.orders(store_id, created_at desc);
create index idx_orders_store_status on public.orders(store_id, status);
create index idx_orders_customer_phone on public.orders(customer_phone);
create unique index idx_orders_store_number on public.orders(store_id, order_number);

create trigger update_orders_updated_at
  before update on public.orders
  for each row execute function update_updated_at_column();

-- ============================================
-- TABELA: store_settings (configurações avançadas por loja)
-- ============================================
create table public.store_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  -- Branding
  primary_color text default '#e85d04',
  secondary_color text default '#1a1a2e',
  font_family text default 'Plus Jakarta Sans',
  -- Funcionamento
  accept_pix boolean default true,
  accept_card boolean default true,
  accept_cash boolean default true,
  allow_pickup boolean default true,
  allow_delivery boolean default true,
  -- Pedido mínimo por tipo
  min_order_delivery numeric(10,2),
  min_order_pickup numeric(10,2),
  -- Horários (JSON: {day: {open, close, closed}})
  schedule jsonb,
  -- WhatsApp Business
  whatsapp_business_number text,
  whatsapp_message_template text,
  -- Notificações
  notify_new_order_email boolean default false,
  notify_new_order_push boolean default true,
  -- SEO / Redes sociais
  meta_title text,
  meta_description text,
  social_image_url text,
  instagram_url text,
  facebook_url text,
  -- Analytics
  ga_measurement_id text,
  fb_pixel_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger update_store_settings_updated_at
  before update on public.store_settings
  for each row execute function update_updated_at_column();

-- ============================================
-- FUNCTION: update_updated_at_column()
-- ============================================
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================
-- FUNCTION: generate_order_number()
-- ============================================
create or replace function public.generate_order_number(p_store_id uuid)
returns text language plpgsql as $$
declare
  v_number text;
  v_count int;
begin
  select count(*) + 1 into v_count
  from public.orders
  where store_id = p_store_id
    and date_trunc('day', created_at) = date_trunc('day', now());
  
  v_number := 'PDV-' || to_char(now(), 'YYYYMMDD') || lpad(v_count::text, 3, '0');
  return v_number;
end;
$$;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Habilita RLS em todas as tabelas
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.addon_groups enable row level security;
alter table public.addon_options enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.orders enable row level security;
alter table public.store_settings enable row level security;

-- ============================================
-- POLICIES: stores
-- ============================================
-- Owner vê/edita suas lojas
create policy "Owner can manage own stores"
  on public.stores for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Staff vê a loja onde trabalha
create policy "Staff can view assigned store"
  on public.stores for select
  using (
    id in (select store_id from public.profiles where id = auth.uid() and role = 'staff')
  );

-- Público pode ver loja ativa pelo slug (para cardápio público)
create policy "Public can view active store by slug"
  on public.stores for select
  using (status = 'open');

-- ============================================
-- POLICIES: profiles
-- ============================================
create policy "Users can manage own profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Owner can view staff profiles in their store"
  on public.profiles for select
  using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

-- ============================================
-- POLICIES: categories
-- ============================================
create policy "Store members can manage categories"
  on public.categories for all
  using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
      union
      select store_id from public.profiles where id = auth.uid()
    )
  )
  with check (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
      union
      select store_id from public.profiles where id = auth.uid()
    )
  );

create policy "Public can view active categories"
  on public.categories for select
  using (
    is_active = true
    and store_id in (select id from public.stores where status = 'open')
  );

-- ============================================
-- POLICIES: products
-- ============================================
create policy "Store members can manage products"
  on public.products for all
  using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
      union
      select store_id from public.profiles where id = auth.uid()
    )
  )
  with check (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
      union
      select store_id from public.profiles where id = auth.uid()
    )
  );

create policy "Public can view available products"
  on public.products for select
  using (
    available = true
    and store_id in (select id from public.stores where status = 'open')
  );

-- ============================================
-- POLICIES: addon_groups
-- ============================================
create policy "Store members can manage addon_groups"
  on public.addon_groups for all
  using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
      union
      select store_id from public.profiles where id = auth.uid()
    )
  )
  with check (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
      union
      select store_id from public.profiles where id = auth.uid()
    )
  );

create policy "Public can view addon_groups"
  on public.addon_groups for select
  using (
    store_id in (select id from public.stores where status = 'open')
  );

-- ============================================
-- POLICIES: addon_options
-- ============================================
create policy "Store members can manage addon_options"
  on public.addon_options for all
  using (
    group_id in (
      select id from public.addon_groups
      where store_id in (
        select id from public.stores where owner_id = auth.uid()
        union
        select store_id from public.profiles where id = auth.uid()
      )
    )
  )
  with check (
    group_id in (
      select id from public.addon_groups
      where store_id in (
        select id from public.stores where owner_id = auth.uid()
        union
        select store_id from public.profiles where id = auth.uid()
      )
    )
  );

create policy "Public can view addon_options"
  on public.addon_options for select
  using (
    group_id in (select id from public.addon_groups where store_id in (select id from public.stores where status = 'open'))
  );

-- ============================================
-- POLICIES: neighborhoods
-- ============================================
create policy "Store members can manage neighborhoods"
  on public.neighborhoods for all
  using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
      union
      select store_id from public.profiles where id = auth.uid()
    )
  )
  with check (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
      union
      select store_id from public.profiles where id = auth.uid()
    )
  );

create policy "Public can view active neighborhoods"
  on public.neighborhoods for select
  using (
    is_active = true
    and store_id in (select id from public.stores where status = 'open')
  );

-- ============================================
-- POLICIES: orders
-- ============================================
create policy "Store members can manage orders"
  on public.orders for all
  using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
      union
      select store_id from public.profiles where id = auth.uid()
    )
  )
  with check (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
      union
      select store_id from public.profiles where id = auth.uid()
    )
  );

-- Cliente anônimo pode criar pedido (para cardápio público)
create policy "Public can create orders for open stores"
  on public.orders for insert
  with check (
    store_id in (select id from public.stores where status = 'open')
  );

-- Cliente pode ver seus próprios pedidos (via phone/email)
create policy "Customer can view own orders"
  on public.orders for select
  using (
    customer_phone = current_setting('request.jwt.claims', true)::json->>'phone'
    or customer_email = current_setting('request.jwt.claims', true)::json->>'email'
  );

-- ============================================
-- POLICIES: store_settings
-- ============================================
create policy "Owner can manage store settings"
  on public.store_settings for all
  using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  )
  with check (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

create policy "Staff can view store settings"
  on public.store_settings for select
  using (
    store_id in (select store_id from public.profiles where id = auth.uid())
  );

create policy "Public can view store settings for open stores"
  on public.store_settings for select
  using (
    store_id in (select id from public.stores where status = 'open')
  );

-- ============================================
-- STORAGE: Bucket para imagens de produtos
-- ============================================
-- Execute no Storage do Supabase ou via Dashboard:
-- insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true);

-- Políticas de Storage (execute após criar bucket)
-- Política: upload apenas para membros da loja
-- create policy "Store members can upload product images"
--   on storage.objects for insert
--   with check (
--     bucket_id = 'product-images'
--     and auth.uid() in (
--       select owner_id from public.stores where id = (storage.foldername(name))[1]::uuid
--       union
--       select store_id from public.profiles where id = auth.uid()
--     )
--   );

-- Política: leitura pública
-- create policy "Public can view product images"
--   on storage.objects for select
--   using (bucket_id = 'product-images');

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'owner'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- DADOS INICIAIS DE EXEMPLO (OPCIONAL)
-- Descomente e ajuste após criar primeiro usuário
-- ============================================
/*
-- Exemplo: Inserir loja de teste (substitua OWNER_ID pelo seu user_id do auth)
-- insert into public.stores (owner_id, slug, name, phone, phone_display, description, address, opening_hours)
-- values (
--   'OWNER_ID_AQUI',
--   'bella-massa',
--   'Pizzaria Bella Massa',
--   '5511999998888',
--   '(11) 99999-8888',
--   'Pizzas artesanais assadas em forno a lenha',
--   'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
--   'Terça a Domingo: 18h30 às 23h30'
-- );

-- Configurações da loja
-- insert into public.store_settings (store_id) 
-- select id from public.stores where slug = 'bella-massa';
*/

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- View: Cardápio completo por loja (para API pública)
create or replace view public.v_store_menu as
select 
  s.id as store_id,
  s.slug,
  s.name as store_name,
  s.phone,
  s.logo_url,
  s.cover_url,
  s.default_delivery_fee,
  s.min_order_value,
  json_agg(
    json_build_object(
      'id', c.id,
      'name', c.name,
      'order', c.display_order,
      'products', (
        select json_agg(
          json_build_object(
            'id', p.id,
            'name', p.name,
            'description', p.description,
            'price', p.base_price,
            'image', p.image_url,
            'is_pizza', p.is_pizza,
            'has_crusts', p.has_crusts,
            'has_extras', p.has_extras,
            'available', p.available,
            'order', p.display_order
          ) order by p.display_order
        )
        from public.products p
        where p.category_id = c.id and p.available = true
      )
    ) order by c.display_order
  ) as categories
from public.stores s
left join public.categories c on c.store_id = s.id and c.is_active = true
where s.status = 'open'
group by s.id, s.slug, s.name, s.phone, s.logo_url, s.cover_url, s.default_delivery_fee, s.min_order_value;

-- View: Pedidos recentes para dashboard
create or replace view public.v_recent_orders as
select 
  o.*,
  s.name as store_name,
  s.slug as store_slug
from public.orders o
join public.stores s on s.id = o.store_id
where o.created_at > now() - interval '30 days'
order by o.created_at desc;