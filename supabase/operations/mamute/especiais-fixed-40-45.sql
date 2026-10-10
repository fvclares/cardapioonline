-- Pizzaria Mamute — valor fixo da dividida nas Pizzas Especiais.
-- Faixa do cardápio (página Especiais): G (MEIA) R$40,00 / GG (MEIA) R$45,00
-- (inteiras G R$45 / GG R$50) — vale para os 19 sabores abaixo.
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
  select id into v_cat from public.categories where store_id=v_store and name='Pizzas Especiais' limit 1;
  if v_cat is null then raise exception 'Categoria Pizzas Especiais não encontrada na loja %', v_store; end if;
  select id into v_g from public.pizza_sizes where store_id=v_store and name ilike 'G (%' and name not ilike 'GG%' order by display_order limit 1;
  select id into v_gg from public.pizza_sizes where store_id=v_store and name ilike 'GG (%' order by display_order limit 1;
  if v_g is null or v_gg is null then raise exception 'Tamanhos G/GG não encontrados na loja %', v_store; end if;
  for r in select * from (values
    ('Calabacon',40,45),
    ('Calapalmito',40,45),
    ('Calabresa c/ Creme Cheese',40,45),
    ('Bacon c/ Palmito',40,45),
    ('Bacon c/ Presunto',40,45),
    ('Bacon c/ Creme Cheese',40,45),
    ('Franbacon',40,45),
    ('Bacon c/ Ovos',40,45),
    ('Bacon c/ Catupiry',40,45),
    ('Lombinho',40,45),
    ('Lombinho c/ Catupiry',40,45),
    ('Frango c/ Creme Cheese',40,45),
    ('Moda do Pizzaiolo',40,45),
    ('Moda do Gordo',40,45),
    ('Quatro Queijos c/ Bacon',40,45),
    ('Cinco Queijos c/ Creme Cheese',40,45),
    ('Maravilhosa',40,45),
    ('Peito de Peru',40,45),
    ('Mexicana',40,45)
  ) as t(name, fix_g, fix_gg) loop
    select id into v_pid from public.products where store_id=v_store and category_id=v_cat and name=r.name limit 1;
    if v_pid is null then
      raise warning 'Produto não encontrado: % (ignorado)', r.name;
      continue;
    end if;
    update public.products set fraction_pricing_mode='fixed', fraction_fixed_price=null, updated_at=now() where id=v_pid;
    update public.product_size_prices set fraction_fixed_price=r.fix_g where product_id=v_pid and size_id=v_g;
    if not found then raise warning 'Sem preço no tamanho G para % (fixo G não aplicado)', r.name; end if;
    update public.product_size_prices set fraction_fixed_price=r.fix_gg where product_id=v_pid and size_id=v_gg;
    if not found then raise warning 'Sem preço no tamanho GG para % (fixo GG não aplicado)', r.name; end if;
    v_n := v_n + 1;
  end loop;
  raise notice 'Especiais com fixo 40/45 aplicado: % de 19', v_n;
end $$;
-- Conferência (esperado: 19 linhas em modo fixed, fixo 40 no G e 45 no GG)
select p.name, p.fraction_pricing_mode as modo,
  max(case when s.name ilike 'GG (%' then v.fraction_fixed_price end) as fixo_gg,
  max(case when s.name ilike 'G (%' and s.name not ilike 'GG%' then v.fraction_fixed_price end) as fixo_g
from public.products p
join public.product_size_prices v on v.product_id=p.id
join public.pizza_sizes s on s.id=v.size_id
where p.store_id='a5f88e35-f150-4c37-a7bd-2220e02ad2c8'
  and p.category_id=(select id from public.categories where store_id='a5f88e35-f150-4c37-a7bd-2220e02ad2c8' and name='Pizzas Especiais' limit 1)
group by p.name, p.fraction_pricing_mode order by p.name;
commit;
