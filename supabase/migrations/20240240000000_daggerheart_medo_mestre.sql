-- ============================================================
-- Vorterium — DaggerHeart: Medo público e fichas do mestre (adversários e ambientes)
-- Migration: 20240240000000_daggerheart_medo_mestre.sql
-- Aplicar após: 20240239000000_daggerheart_npc.sql
--
--   • dh_fear: o contador de Medo do mestre, que todos da campanha veem (0 a 12). O mestre muda como quiser; qualquer
--     membro pode somar Medo (é o que acontece ao rolar com Medo), pela função dh_fear_gain.
--   • dh_gm_sheets: fichas de adversário e de ambiente (jsonb). O mestre cria e edita; os jogadores só leem as que ele mostrar.
-- ============================================================

-- ── 1. Medo ─────────────────────────────────────────────────

create table if not exists public.dh_fear (
  campaign_id uuid        primary key references public.campaigns(id) on delete cascade,
  value       smallint    not null default 0 check (value between 0 and 12),
  updated_at  timestamptz not null default now()
);

alter table public.dh_fear enable row level security;

drop policy if exists "dh_fear_select" on public.dh_fear;
create policy "dh_fear_select" on public.dh_fear for select
  using (public.is_campaign_member(campaign_id, auth.uid()));

drop policy if exists "dh_fear_write" on public.dh_fear;
create policy "dh_fear_write" on public.dh_fear for all
  using (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));

-- Qualquer membro soma Medo (1 a 3 por vez): rolou com Medo, o mestre ganha 1.
create or replace function public.dh_fear_gain(p_campaign uuid, p_amount integer default 1)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v smallint;
begin
  if auth.uid() is null or not public.is_campaign_member(p_campaign, auth.uid()) then
    raise exception 'Apenas membros da campanha podem somar Medo.';
  end if;
  if p_amount < 1 or p_amount > 3 then
    raise exception 'Quantidade de Medo inválida.';
  end if;
  insert into public.dh_fear (campaign_id, value, updated_at)
  values (p_campaign, least(12, p_amount), now())
  on conflict (campaign_id) do update
    set value = least(12, public.dh_fear.value + p_amount), updated_at = now()
  returning value into v;
  return v;
end;
$$;

revoke all on function public.dh_fear_gain(uuid, integer) from public;
grant execute on function public.dh_fear_gain(uuid, integer) to authenticated;

-- ── 2. Fichas do mestre (adversários e ambientes) ───────────

create table if not exists public.dh_gm_sheets (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  kind        text        not null check (kind in ('adversary', 'environment')),
  data        jsonb       not null default '{}'::jsonb,
  visible     boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists dh_gm_sheets_campaign_idx on public.dh_gm_sheets (campaign_id, kind);
alter table public.dh_gm_sheets drop constraint if exists dh_gm_sheets_data_size;
alter table public.dh_gm_sheets add constraint dh_gm_sheets_data_size check (pg_column_size(data) < 200000);

create or replace function public.dh_gm_sheets_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and (new.campaign_id <> old.campaign_id or new.kind <> old.kind) then
    raise exception 'A campanha e o tipo da ficha não mudam.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dh_gm_sheets_touch on public.dh_gm_sheets;
create trigger trg_dh_gm_sheets_touch
  before insert or update on public.dh_gm_sheets
  for each row execute function public.dh_gm_sheets_touch();

alter table public.dh_gm_sheets enable row level security;

drop policy if exists "dh_gm_master" on public.dh_gm_sheets;
create policy "dh_gm_master" on public.dh_gm_sheets for all
  using (public.is_campaign_master(campaign_id, auth.uid()))
  with check (public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "dh_gm_visible" on public.dh_gm_sheets;
create policy "dh_gm_visible" on public.dh_gm_sheets for select
  using (visible and public.is_campaign_member(campaign_id, auth.uid()));

-- ── 3. Tempo real ───────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.dh_fear;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.dh_gm_sheets;
exception when duplicate_object then null; when undefined_object then null;
end $$;
