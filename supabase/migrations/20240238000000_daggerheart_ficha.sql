-- ============================================================
-- Vorterium — DaggerHeart: a ficha (Livro Básico)
-- Migration: 20240238000000_daggerheart_ficha.sql
-- Aplicar após: 20240237000000_daggerheart_base.sql
--
-- A ficha inteira (classe, atributos, cartas, armas, subidas de nível...) fica numa linha jsonb por jogador
-- e campanha; o site valida e recalcula tudo. Derruba as tabelas da primeira versão (dh_character_sheets e filhas),
-- que não tinham nada a ver com o livro, caso a 237 antiga tenha sido rodada.
-- ============================================================

-- ── 1. Limpa a primeira versão (se existir) ─────────────────

drop table if exists public.dh_inventory       cascade;
drop table if exists public.dh_weapons         cascade;
drop table if exists public.dh_domain_cards    cascade;
drop table if exists public.dh_experiences     cascade;
drop table if exists public.dh_character_sheets cascade;
drop function if exists public.can_read_dh_sheet(uuid);
drop function if exists public.can_write_dh_sheet(uuid);
drop function if exists public.set_dh_sheet_updated_at();
drop function if exists public.protect_dh_sheet_structural_fields();

-- ── 2. A ficha ──────────────────────────────────────────────

create table if not exists public.dh_sheets (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id)  on delete cascade,
  data        jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create index if not exists dh_sheets_campaign_idx on public.dh_sheets (campaign_id);

-- tamanho razoável: nenhuma ficha precisa de mais que isso
alter table public.dh_sheets drop constraint if exists dh_sheets_data_size;
alter table public.dh_sheets add constraint dh_sheets_data_size check (pg_column_size(data) < 400000);

-- ── 3. Gatilhos: hora da última mudança e campos que não mudam ──

create or replace function public.dh_sheets_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    if new.campaign_id <> old.campaign_id then raise exception 'A campanha da ficha não pode ser alterada.'; end if;
    if new.user_id <> old.user_id then raise exception 'O dono da ficha não pode ser alterado.'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dh_sheets_touch on public.dh_sheets;
create trigger trg_dh_sheets_touch
  before insert or update on public.dh_sheets
  for each row execute function public.dh_sheets_touch();

-- ── 4. Segurança: o dono e o mestre da campanha ─────────────

alter table public.dh_sheets enable row level security;

drop policy if exists "dh_sheets_select" on public.dh_sheets;
create policy "dh_sheets_select"
  on public.dh_sheets for select
  using (
    public.is_campaign_master(campaign_id, auth.uid())
    or (user_id = auth.uid() and public.is_campaign_member(campaign_id, auth.uid()))
  );

drop policy if exists "dh_sheets_insert" on public.dh_sheets;
create policy "dh_sheets_insert"
  on public.dh_sheets for insert
  with check (
    user_id = auth.uid()
    and public.is_campaign_member(campaign_id, auth.uid())
    and exists (select 1 from public.campaigns c where c.id = campaign_id and c.system = 'daggerheart')
  );

drop policy if exists "dh_sheets_update" on public.dh_sheets;
create policy "dh_sheets_update"
  on public.dh_sheets for update
  using (
    public.is_campaign_master(campaign_id, auth.uid())
    or (user_id = auth.uid() and public.is_campaign_member(campaign_id, auth.uid()))
  )
  with check (
    public.is_campaign_master(campaign_id, auth.uid())
    or (user_id = auth.uid() and public.is_campaign_member(campaign_id, auth.uid()))
  );

drop policy if exists "dh_sheets_delete" on public.dh_sheets;
create policy "dh_sheets_delete"
  on public.dh_sheets for delete
  using (
    public.is_campaign_master(campaign_id, auth.uid())
    or user_id = auth.uid()
  );

-- ── 5. Tempo real ───────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.dh_sheets;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
