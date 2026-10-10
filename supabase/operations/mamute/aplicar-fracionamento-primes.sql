-- APLICAR FRACIONAMENTO + FIXO DAS PRIMES (arquivo único)
-- Como usar: cole TUDO no SQL Editor do Supabase (produção) e clique em Run.
-- Ordem executada: (1) colunas products.fraction_* + normalização
--                  (2) coluna product_size_prices.fraction_fixed_price + RPC atualizada
--                  (3) fixo 50 (G) / 55 (GG) nas 11 Primes + conferência
-- Idempotente: pode rodar mais de uma vez sem duplicar nada.
begin;
-- Precificação fracionada por produto (remove o modelo global de store_settings):
-- cada pizza define: max (mais cara) | average (média) | fixed (valor específico).
alter table public.products
  add column if not exists fraction_pricing_mode text not null default 'max',
  add column if not exists fraction_fixed_price numeric null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_fraction_pricing_mode_check'
  ) then
    alter table public.products
      add constraint products_fraction_pricing_mode_check
      check (fraction_pricing_mode in ('max','average','fixed'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'products_fraction_fixed_price_check'
  ) then
    alter table public.products
      add constraint products_fraction_fixed_price_check
      check (fraction_fixed_price is null or (fraction_fixed_price > 0 and fraction_fixed_price <= 99999999.99));
  end if;
end $$;

-- Normaliza valores legados (proportional/proporcional -> average)
update public.products
  set fraction_pricing_mode = 'average'
  where fraction_pricing_mode in ('proportional','proporcional');


-- Valor fixo da dividida por tamanho: cada tamanho oferecido tem seu próprio
-- preço quando a pizza participa de uma divisão (products.fraction_pricing_mode='fixed').
alter table public.product_size_prices
  add column if not exists fraction_fixed_price numeric null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_size_prices_fraction_fixed_price_check'
  ) then
    alter table public.product_size_prices
      add constraint product_size_prices_fraction_fixed_price_check
      check (fraction_fixed_price is null or (fraction_fixed_price > 0 and fraction_fixed_price <= 99999999.99));
  end if;
end $$;

-- RPC passa a persistir o fixo por tamanho (p_prices[].fraction_fixed_price, opcional).
-- No modo 'fixed', cada tamanho com preço exige seu valor fixo.
create or replace function public.save_product_with_prices(p_store_id uuid,p_product_id uuid,p_product jsonb,p_prices jsonb)
returns public.products language plpgsql security invoker set search_path='' as $$
declare
  saved public.products;
  entry jsonb;
  pid uuid:=coalesce(p_product_id,gen_random_uuid());
  amount numeric;
  fixed_amount numeric;
  frac_mode text:=coalesce(nullif(p_product->>'fraction_pricing_mode',''),'max');
  frac_fixed numeric:=null;
begin
 set constraints public.product_catalog_valid,public.product_price_catalog_valid,public.pizza_size_catalog_valid deferred;
 if auth.uid() is null or not private.member_store(p_store_id) then
   raise exception 'Loja não autorizada' using errcode='42501';
 end if;
 if jsonb_typeof(p_product) is distinct from 'object' or jsonb_typeof(p_prices) is distinct from 'array' then
   raise exception 'Cadastro inválido' using errcode='22023';
 end if;
 if jsonb_array_length(p_prices)>100 then raise exception 'Quantidade de tamanhos inválida'; end if;
 if frac_mode in ('proportional','proporcional') then frac_mode:='average'; end if;
 if frac_mode not in ('max','average','fixed') then frac_mode:='max'; end if;
 if p_product ? 'fraction_fixed_price' and (p_product->>'fraction_fixed_price') is not null and (p_product->>'fraction_fixed_price') <> 'null' and (p_product->>'fraction_fixed_price') <> '' then
   frac_fixed:=(p_product->>'fraction_fixed_price')::numeric;
   if frac_fixed is not null and (frac_fixed<=0 or frac_fixed>99999999.99 or frac_fixed<>round(frac_fixed,2)) then
     raise exception 'Valor fixo da dividida inválido' using errcode='22023';
   end if;
 else
   frac_fixed:=null;
 end if;
 if frac_mode<>'fixed' then frac_fixed:=null; end if;
 -- Acquire the statement fence before the first tuple lock. No product is changed.
 update public.products set id=id where false;
 if p_product_id is not null then
   select * into saved from public.products where id=pid and store_id=p_store_id for update;
   if not found then raise exception 'Produto não autorizado' using errcode='42501'; end if;
   update public.products set name=p_product->>'name',category_id=(p_product->>'category_id')::uuid,
    description=p_product->>'description',image_url=p_product->>'image_url',codigo=(p_product->>'codigo')::integer,
    is_pizza=(p_product->>'is_pizza')::boolean,available=(p_product->>'available')::boolean,
    has_crusts=(p_product->>'has_crusts')::boolean,has_extras=(p_product->>'has_extras')::boolean,
    is_featured=(p_product->>'is_featured')::boolean,featured_order=(p_product->>'featured_order')::integer,
    fraction_pricing_mode=frac_mode,fraction_fixed_price=frac_fixed,
    base_price=case when (p_product->>'is_pizza')::boolean then 0 else (p_product->>'base_price')::numeric end
   where id=pid and store_id=p_store_id returning * into saved;
 else
   insert into public.products(id,store_id,name,category_id,description,image_url,codigo,is_pizza,available,has_crusts,has_extras,is_featured,featured_order,fraction_pricing_mode,fraction_fixed_price,base_price)
   values(pid,p_store_id,p_product->>'name',(p_product->>'category_id')::uuid,p_product->>'description',p_product->>'image_url',
    (p_product->>'codigo')::integer,(p_product->>'is_pizza')::boolean,(p_product->>'available')::boolean,
    (p_product->>'has_crusts')::boolean,(p_product->>'has_extras')::boolean,(p_product->>'is_featured')::boolean,
    (p_product->>'featured_order')::integer,frac_mode,frac_fixed,case when (p_product->>'is_pizza')::boolean then 0 else (p_product->>'base_price')::numeric end)
   returning * into saved;
 end if;
 if not saved.is_pizza and jsonb_array_length(p_prices)>0 then raise exception 'Produto comum não recebe preços de pizza'; end if;
 if (select count(*)<>count(distinct e->>'size_id') from jsonb_array_elements(p_prices) e) then raise exception 'Tamanho repetido'; end if;
 delete from public.product_size_prices where product_id=pid;
 for entry in select * from jsonb_array_elements(p_prices) loop
   if jsonb_typeof(entry->'price') is distinct from 'number' then raise exception 'Preço deve ser numérico'; end if;
   amount:=(entry->>'price')::numeric;
   if amount<=0 or amount>99999999.99 or amount<>round(amount,2) then raise exception 'Preço inválido'; end if;
   fixed_amount:=null;
   if entry ? 'fraction_fixed_price' and (entry->>'fraction_fixed_price') is not null and (entry->>'fraction_fixed_price') <> 'null' and (entry->>'fraction_fixed_price') <> '' then
     if jsonb_typeof(entry->'fraction_fixed_price') is distinct from 'number' then raise exception 'Valor fixo da dividida deve ser numérico'; end if;
     fixed_amount:=(entry->>'fraction_fixed_price')::numeric;
     if fixed_amount is not null and (fixed_amount<=0 or fixed_amount>99999999.99 or fixed_amount<>round(fixed_amount,2)) then raise exception 'Valor fixo da dividida inválido'; end if;
   end if;
   if frac_mode='fixed' and saved.is_pizza and fixed_amount is null then raise exception 'Informe o valor fixo da dividida para cada tamanho com preço' using errcode='22023'; end if;
   if frac_mode<>'fixed' then fixed_amount:=null; end if;
   insert into public.product_size_prices(product_id,size_id,price,fraction_fixed_price) values(pid,(entry->>'size_id')::uuid,amount,fixed_amount);
 end loop;
 if saved.is_pizza then
   update public.products set base_price=coalesce((select min(price) from public.product_size_prices where product_id=pid),0) where id=pid returning * into saved;
 end if;
 -- Force deferred checks before returning success to the caller.
 set constraints public.product_catalog_valid,public.product_price_catalog_valid,public.pizza_size_catalog_valid immediate;
 return saved;
end $$;
revoke all on function public.save_product_with_prices(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_product_with_prices(uuid,uuid,jsonb,jsonb) to authenticated;

-- Pizzaria Mamute — valor fixo da dividida nas Pizzas Primes (faixa 50/55).
-- Aplica (idempotente, NÃO apaga nada):
--   products.fraction_pricing_mode = 'fixed' nas 11 Primes da faixa MEIA G R$50 / MEIA GG R$55
--   product_size_prices.fraction_fixed_price = 50 (G) e 55 (GG) nesses produtos
-- Pré-requisitos: migrations 20261010140000_product_fraction_pricing e
-- 20261010150000_product_size_fraction_fixed aplicadas. Rode no SQL Editor (postgres, sem RLS).
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
