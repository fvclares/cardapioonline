-- Pizzaria Mamute — valor fixo da dividida nas Pizzas Primes (faixa 50/55).
-- Aplica (idempotente, NÃO apaga nada):
--   products.fraction_pricing_mode = 'fixed' nas 11 Primes da faixa MEIA G R$50 / MEIA GG R$55
--   product_size_prices.fraction_fixed_price = 50 (G) e 55 (GG) nesses produtos
-- Pré-requisitos: migrations 20261010140000_product_fraction_pricing e
-- 20261010150000_product_size_fraction_fixed aplicadas. Rode no SQL Editor (postgres, sem RLS).
begin;
do $$
declare
  v_store uuid := 'a5f88e35-f150-4c37-a7bd-2220e02ad2c8'; -- pizzaria-mamute
  v_cat uuid;
  v_g uuid;
  v_gg uuid;
  v_names text[] := array[
    'Charque','Charque c/ Creme Cheese','Camarão Regional','Camarão c/ Catupiry',
    'Camarão c/ Creme Cheese','Filé','Filé com Bacon','Filé com Creme Cheese',
    'Carne de Sol','Atum','Peruana'
  ];
  v_name text;
  v_pid uuid;
  v_n int := 0;
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
  foreach v_name in array v_names loop
    select id into v_pid from public.products where store_id=v_store and category_id=v_cat and name=v_name limit 1;
    if v_pid is null then
      raise warning 'Produto não encontrado: % (ignorado)', v_name;
      continue;
    end if;
    update public.products set fraction_pricing_mode='fixed', fraction_fixed_price=null, updated_at=now() where id=v_pid;
    update public.product_size_prices set fraction_fixed_price=50 where product_id=v_pid and size_id=v_g;
    if not found then raise warning 'Sem preço no tamanho G para % (fixo G não aplicado)', v_name; end if;
    update public.product_size_prices set fraction_fixed_price=55 where product_id=v_pid and size_id=v_gg;
    if not found then raise warning 'Sem preço no tamanho GG para % (fixo GG não aplicado)', v_name; end if;
    v_n := v_n + 1;
  end loop;
  raise notice 'Primes com fixo 50/55 aplicado: % de %', v_n, array_length(v_names, 1);
end $$;
-- Conferência (esperado: 11 linhas em modo fixed, fixo 50 no G e 55 no GG)
select p.name, p.fraction_pricing_mode as modo,
  max(case when s.name ilike 'GG (%' then v.fraction_fixed_price end) as fixo_gg,
  max(case when s.name ilike 'G (%' and s.name not ilike 'GG%' then v.fraction_fixed_price end) as fixo_g
from public.products p
join public.product_size_prices v on v.product_id=p.id
join public.pizza_sizes s on s.id=v.size_id
where p.store_id='a5f88e35-f150-4c37-a7bd-2220e02ad2c8'
  and p.name in ('Charque','Charque c/ Creme Cheese','Camarão Regional','Camarão c/ Catupiry','Camarão c/ Creme Cheese','Filé','Filé com Bacon','Filé com Creme Cheese','Carne de Sol','Atum','Peruana')
group by p.name, p.fraction_pricing_mode order by p.name;
commit;
