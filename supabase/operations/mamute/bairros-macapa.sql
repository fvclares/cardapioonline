-- Pizzaria Mamute — todos os bairros de Macapá/AP com taxa de entrega R$10,00.
-- Lista oficial da Prefeitura (2021): 60 bairros. Idempotente: não duplica;
-- atualiza taxa/ordem dos já existentes e preserva bairros fora da lista.
-- Rode no SQL Editor (postgres, sem RLS).
do $$
declare
  v_store uuid := 'a5f88e35-f150-4c37-a7bd-2220e02ad2c8'; -- pizzaria-mamute
  v_names text[] := array[
    'Açaí','Alvorada','Amazonas','Araxá','Beirol','Bella Ville','Bioparque','Boné Azul',
    'Brasil Novo','Buritis','Buritizal','Cabralzinho','Cajari','Central','Chefe Clodoaldo',
    'Cidade Nova','Congós','Coração','Fazendinha','Goiabal','Igarapé da Fortaleza','Ilha Mirim',
    'Infraero I','Infraero II','Ipê','Jardim América','Jardim das Acácias','Jardim Equatorial',
    'Jardim Felicidade I','Jardim Felicidade II','Jardim Marco Zero','Jesus de Nazaré','KM 9',
    'Lago da Vaca','Lagoa Azul','Laguinho','Macapaba','Marabaixo I','Marabaixo II','Marabaixo III',
    'Morada das Palmeiras','Muca','Murici','Nova Esperança','Novo Buritizal','Novo Horizonte',
    'Pacoval','Palácio das Águas','Pantanal','Parque Aeroportuário','Parque dos Jardins','Pedrinhas',
    'Perpétuo Socorro','Renascer','Santa Inês','Santa Rita','São José','São Lázaro','Sol Nascente','Trem'
  ];
  v_name text;
  v_i int := 0;
  v_ins int := 0;
begin
  foreach v_name in array v_names loop
    v_i := v_i + 1;
    if not exists (select 1 from public.neighborhoods where store_id=v_store and name=v_name) then
      insert into public.neighborhoods(store_id,name,delivery_fee,is_active,display_order)
      values (v_store,v_name,10,true,v_i);
      v_ins := v_ins + 1;
    else
      update public.neighborhoods set delivery_fee=10, is_active=true, display_order=v_i
      where store_id=v_store and name=v_name;
    end if;
  end loop;
  raise notice 'Bairros Macapá: % novos, % na lista, total na loja: %',
    v_ins, array_length(v_names,1),
    (select count(*) from public.neighborhoods where store_id=v_store);
end $$;
-- Conferência (esperado: 60 linhas, todas com delivery_fee = 10)
select count(*) as total, count(*) filter (where delivery_fee=10 and is_active) as com_taxa_10
from public.neighborhoods where store_id='a5f88e35-f150-4c37-a7bd-2220e02ad2c8';
