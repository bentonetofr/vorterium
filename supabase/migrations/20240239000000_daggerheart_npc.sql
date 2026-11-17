-- ============================================================
-- Vorterium — DaggerHeart: fichas de NPC do mestre
-- Migration: 20240239000000_daggerheart_npc.sql
-- Aplicar após: 20240238000000_daggerheart_ficha.sql
--
-- Igual aos outros sistemas (migration 189): is_npc, npc_visible, uma ficha de jogador por pessoa,
-- só o mestre cria, altera, mostra e apaga NPCs; NPC mostrado, os jogadores leem.
-- character_name acompanha o nome que está dentro da ficha.
-- ============================================================

alter table public.dh_sheets
  add column if not exists character_name text,
  add column if not exists is_npc         boolean not null default false,
  add column if not exists npc_visible    boolean not null default false;

alter table public.dh_sheets drop constraint if exists dh_sheets_campaign_id_user_id_key;
create unique index if not exists dh_sheets_one_pc_per_user on public.dh_sheets (campaign_id, user_id) where not is_npc;
create index if not exists dh_sheets_npcs on public.dh_sheets (campaign_id) where is_npc;

create or replace function public.dh_sheets_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if coalesce(new.data->>'name', '') <> '' then
    new.character_name := left(new.data->>'name', 120);
  end if;
  if tg_op = 'UPDATE' then
    if new.campaign_id <> old.campaign_id then raise exception 'A campanha da ficha não pode ser alterada.'; end if;
    if new.user_id <> old.user_id then raise exception 'O dono da ficha não pode ser alterado.'; end if;
  end if;
  return new;
end;
$$;

drop policy if exists "npc: so o mestre cria" on public.dh_sheets;
create policy "npc: so o mestre cria" on public.dh_sheets
  as restrictive for insert to authenticated
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "npc: so o mestre altera" on public.dh_sheets;
create policy "npc: so o mestre altera" on public.dh_sheets
  as restrictive for update to authenticated
  using (not is_npc or public.is_campaign_master(campaign_id, auth.uid()))
  with check (not is_npc or public.is_campaign_master(campaign_id, auth.uid()));

drop policy if exists "npc: visivel pros jogadores" on public.dh_sheets;
create policy "npc: visivel pros jogadores" on public.dh_sheets
  for select to authenticated
  using (is_npc and npc_visible and public.is_campaign_member(campaign_id, auth.uid()));

-- ficha de jogador: o dono apaga a sua; NPC: o mestre (a policy de delete da 238 já cobre os dois)
drop trigger if exists npc_kind_fixed on public.dh_sheets;
create trigger npc_kind_fixed
  before update on public.dh_sheets
  for each row execute function public.npc_kind_fixed();
