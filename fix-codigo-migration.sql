-- Migração: adicionar campo codigo aos produtos
-- Execute no SQL Editor do Supabase se a tabela products já existe

alter table public.products add column if not exists codigo int check (codigo between 1 and 999);

-- Índice único por loja (permite null, evita duplicidade)
create unique index if not exists idx_products_store_codigo on public.products(store_id, codigo) where codigo is not null;

-- Inicializa códigos existentes sequencialmente por loja (101, 102...)
-- Ajuste se quiser começar em 1
do $$
declare
  r record;
  n int;
begin
  for r in select distinct store_id from public.products where codigo is null loop
    n := 101;
    for prod in select id from public.products where store_id = r.store_id and codigo is null order by created_at loop
      update public.products set codigo = n where id = prod.id;
      n := n + 1;
    end loop;
  end loop;
end $$;
