-- ============================================
-- CAMPANHAS - Agrupa ofertas em período (ex: Semana do Cliente 01/09->07/09)
-- Fase 3: reutiliza ofertas sem duplicar estrutura
-- ============================================

create table if not exists public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  active boolean not null default true,
  display_order int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_campaigns_store on public.campaigns(store_id);
create index if not exists idx_campaigns_store_active on public.campaigns(store_id, active);
drop trigger if exists update_campaigns_updated_at on public.campaigns;
create trigger update_campaigns_updated_at before update on public.campaigns for each row execute function update_updated_at_column();

create table if not exists public.campaign_offers (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campaign_id, offer_id)
);
create index if not exists idx_campaign_offers_campaign on public.campaign_offers(campaign_id);
create index if not exists idx_campaign_offers_offer on public.campaign_offers(offer_id);

alter table public.campaigns enable row level security;
alter table public.campaign_offers enable row level security;

drop policy if exists "Store members can manage campaigns" on public.campaigns;
create policy "Store members can manage campaigns" on public.campaigns for all using (
  store_id in (select id from public.stores where owner_id=auth.uid() union select store_id from public.profiles where id=auth.uid())
) with check (
  store_id in (select id from public.stores where owner_id=auth.uid() union select store_id from public.profiles where id=auth.uid())
);
drop policy if exists "Public can view active campaigns" on public.campaigns;
create policy "Public can view active campaigns" on public.campaigns for select using (
  active=true and store_id in (select id from public.stores where status='open')
);

drop policy if exists "Store members can manage campaign_offers" on public.campaign_offers;
create policy "Store members can manage campaign_offers" on public.campaign_offers for all using (
  campaign_id in (select id from public.campaigns where store_id in (select id from public.stores where owner_id=auth.uid() union select store_id from public.profiles where id=auth.uid()))
) with check (
  campaign_id in (select id from public.campaigns where store_id in (select id from public.stores where owner_id=auth.uid() union select store_id from public.profiles where id=auth.uid()))
);
drop policy if exists "Public can view campaign_offers" on public.campaign_offers;
create policy "Public can view campaign_offers" on public.campaign_offers for select using (
  campaign_id in (select id from public.campaigns where active=true and store_id in (select id from public.stores where status='open'))
);
