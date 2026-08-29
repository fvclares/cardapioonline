-- ============================================
-- Modelo de precificacao para pizzas fracionadas (1/2, 1/4)
-- Permite loja escolher entre "maior" e "proporcional"
-- Execute no SQL Editor do Supabase
-- ============================================

-- Adiciona coluna em store_settings (se nao existir)
alter table public.store_settings add column if not exists fraction_pricing_mode text default 'max' check (fraction_pricing_mode in ('max','proporcional','proportional'));

-- Normaliza valores antigos: garante que 'proporcional' seja aceito (pt-BR)
-- Nao necessario check case sensitive, mas mantem ambos
comment on column public.store_settings.fraction_pricing_mode is 'Modelo de precificacao para pizzas fracionadas: max = cobra maior sabor, proporcional = soma proporcional das metades';

-- Atualiza lojas existentes sem valor para max
update public.store_settings set fraction_pricing_mode='max' where fraction_pricing_mode is null;

-- Fallback: tambem permite armazenar em stores.settings jsonb (se preferir json)
-- Nao precisa migrar json, apenas coluna nova
