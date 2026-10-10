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

-- RPC passa a persistir os campos novos (payload continua compatível com o antigo)
create or replace function public.save_product_with_prices(p_store_id uuid,p_product_id uuid,p_product jsonb,p_prices jsonb)
returns public.products language plpgsql security invoker set search_path='' as $$
declare
  saved public.products;
  entry jsonb;
  pid uuid:=coalesce(p_product_id,gen_random_uuid());
  amount numeric;
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
 if frac_mode='fixed' and frac_fixed is null then
   raise exception 'Informe o valor específico da dividida' using errcode='22023';
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
   insert into public.product_size_prices(product_id,size_id,price) values(pid,(entry->>'size_id')::uuid,amount);
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
commit;
