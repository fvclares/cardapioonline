-- Pizzaria Mamute — valor fixo da dividida nas demais Pizzas Primes.
-- Faixas do cardápio (página Primes):
--   G (MEIA) R$55 / GG (MEIA) R$60 : Filé com Frita, Carne de Sol c/ Fritas
--   G (MEIA) R$65 / GG (MEIA) R$70 : Costela Desfiada, Costela Desfiada com Creme Cheese,
--                                    Strogonoff de Carne, Strogonoff de Frango, Strogonoff de Camarão Regional
-- Idempotente, NÃO apaga nada. Pré-requisito: aplicar antes
-- supabase/operations/mamute/aplicar-fracionamento-primes.sql (ou as 2 migrations).
-- Rode no SQL Editor (postgres, sem RLS).
begin;
do $$
declare
  v_store uuid := 'a5f88e35-f150-4c37-a7bd-2220e02ad2c8'; -- pizzaria-mamute
  v_cat uuid;
  v_g uuid;
  v_gg uuid;
  v_fix_g numeric;
  v_fix_gg numeric;
  v_name text;
  v_pid uuid;
  v_n int := 0;
  r record;
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='fraction_pricing_mode') then
    raise exception 'Falta a migration 20261010140000_product_fraction_pricing (products.fraction_pricing_mode)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='product_size_prices' and column_name='fraction_fixed_price') then
    raise exception 'Falta a migration 20261010150000_product_size_fraction_fixed (product_size_prices.fraction_fixed_price)';
  end if;
  select id into v_cat from public.categories where store_id=v_store and name='Pizzas Primes' limit 1;
  if v_cat is null then raise exception 'Categoria Pizzas Primes não encontrada na loja %', v_store; end if;
  select id into v_g from public.pizza_sizes where store_id=v_store and name ilike 'G (%' and name not ilike 'GG%' order by display_order limit 1;
  select id into v_gg from public.pizza_sizes where store_id=v_store and name ilike 'GG (%' order by display_order limit 1;
  if v_g is null or v_gg is null then raise exception 'Tamanhos G/GG não encontrados na loja %', v_store; end if;
  for r in select * from (values
    ('Filé com Frita',55,60),
    ('Carne de Sol c/ Fritas',55,60),
    ('Costela Desfiada',65,70),
    ('Costela Desfiada com Creme Cheese',65,70),
    ('Strogonoff de Carne',65,70),
    ('Strogonoff de Frango',65,70),
    ('Strogonoff de Camarão Regional',65,70)
  ) as t(name, fix_g, fix_gg) loop
    v_name := r.name; v_fix_g := r.fix_g; v_fix_gg := r.fix_gg;
    select id into v_pid from public.products where store_id=v_store and category_id=v_cat and name=v_name limit 1;
    if v_pid is null then
      raise warning 'Produto não encontrado: % (ignorado)', v_name;
      continue;
    end if;
    update public.products set fraction_pricing_mode='fixed', fraction_fixed_price=null, updated_at=now() where id=v_pid;
    update public.product_size_prices set fraction_fixed_price=v_fix_g where product_id=v_pid and size_id=v_g;
    if not found then raise warning 'Sem preço no tamanho G para % (fixo G não aplicado)', v_name; end if;
    update public.product_size_prices set fraction_fixed_price=v_fix_gg where product_id=v_pid and size_id=v_gg;
    if not found then raise warning 'Sem preço no tamanho GG para % (fixo GG não aplicado)', v_name; end if;
    v_n := v_n + 1;
  end loop;
  raise notice 'Primes restantes com fixo aplicado: % de 7', v_n;
end $$;
-- Conferência (esperado: 7 linhas em modo fixed com seus fixos)
select p.name, p.fraction_pricing_mode as modo,
  max(case when s.name ilike 'GG (%' then v.fraction_fixed_price end) as fixo_gg,
  max(case when s.name ilike 'G (%' and s.name not ilike 'GG%' then v.fraction_fixed_price end) as fixo_g
from public.products p
join public.product_size_prices v on v.product_id=p.id
join public.pizza_sizes s on s.id=v.size_id
where p.store_id='a5f88e35-f150-4c37-a7bd-2220e02ad2c8'
  and p.name in ('Filé com Frita','Carne de Sol c/ Fritas','Costela Desfiada','Costela Desfiada com Creme Cheese','Strogonoff de Carne','Strogonoff de Frango','Strogonoff de Camarão Regional')
group by p.name, p.fraction_pricing_mode order by p.name;
commit;
