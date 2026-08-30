-- ============================================
-- FIX: Carrossel de Promoções - flag em products
-- Lojista marca ⭐ Destacar no carrossel e ordena
-- ============================================

-- Adiciona colunas se não existirem
alter table public.products
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_order int not null default 0;

-- Índice para busca rápida dos destaques por loja (usado no cardápio público)
create index if not exists idx_products_store_featured
  on public.products(store_id, is_featured, featured_order, display_order)
  where is_featured = true;

-- Comentários
comment on column public.products.is_featured is '⭐ Destacar no carrossel do topo (vitrine de promoções)';
comment on column public.products.featured_order is 'Ordem dentro do carrossel (1..5)';
