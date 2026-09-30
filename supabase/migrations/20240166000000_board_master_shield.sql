-- ============================================================
-- Vorterium — Escudo do mestre no Quadro da campanha
-- Migration: 20240166000000_board_master_shield.sql
-- Aplicar após: 20240165000000_player_notes_images.sql
-- ============================================================
--
-- O Quadro ganha uma segunda aba, só dos mestres: o "Escudo do mestre",
-- um quadro infinito igual ao geral, mas que os jogadores nem sabem que
-- existe. Cada item diz em qual quadro está (board = 'geral' | 'mestre').
--
--  • 'geral'  → como antes: todos os membros veem e editam.
--  • 'mestre' → só os mestres da campanha veem, criam, editam e apagam.
--  • Um item não troca de quadro depois de criado.

alter table public.campaign_board_items
  add column if not exists board text not null default 'geral';

do $$
begin
  alter table public.campaign_board_items
    add constraint campaign_board_items_board check (board in ('geral', 'mestre'));
exception when duplicate_object then null;
end;
$$;

create index if not exists idx_campaign_board_items_campaign_board
  on public.campaign_board_items(campaign_id, board);

-- Guarda do 20240164 + o quadro não muda depois de criado.
create or replace function public.campaign_board_items_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    if not public.is_campaign_master(new.campaign_id, auth.uid()) then
      new.locked := false;
    end if;
  else
    new.campaign_id := old.campaign_id;
    new.board       := old.board;
    new.created_by  := old.created_by;
    new.created_at  := old.created_at;
    if not public.is_campaign_master(old.campaign_id, auth.uid()) then
      new.locked := old.locked;
    end if;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

-- Regras do 20240164 refeitas com o quadro do mestre fechado pros jogadores.
drop policy if exists "board: membros veem" on public.campaign_board_items;
create policy "board: membros veem"
  on public.campaign_board_items for select
  to authenticated
  using (
    public.is_campaign_member(campaign_id, auth.uid())
    and (board = 'geral' or public.is_campaign_master(campaign_id, auth.uid()))
  );

drop policy if exists "board: membros criam" on public.campaign_board_items;
create policy "board: membros criam"
  on public.campaign_board_items for insert
  to authenticated
  with check (
    public.is_campaign_member(campaign_id, auth.uid())
    and (board = 'geral' or public.is_campaign_master(campaign_id, auth.uid()))
  );

drop policy if exists "board: membros editam (trancado so o mestre)" on public.campaign_board_items;
create policy "board: membros editam (trancado so o mestre)"
  on public.campaign_board_items for update
  to authenticated
  using (
    public.is_campaign_member(campaign_id, auth.uid())
    and (not locked or public.is_campaign_master(campaign_id, auth.uid()))
    and (board = 'geral' or public.is_campaign_master(campaign_id, auth.uid()))
  )
  with check (
    public.is_campaign_member(campaign_id, auth.uid())
    and (board = 'geral' or public.is_campaign_master(campaign_id, auth.uid()))
  );

drop policy if exists "board: membros apagam (trancado so o mestre)" on public.campaign_board_items;
create policy "board: membros apagam (trancado so o mestre)"
  on public.campaign_board_items for delete
  to authenticated
  using (
    public.is_campaign_member(campaign_id, auth.uid())
    and (not locked or public.is_campaign_master(campaign_id, auth.uid()))
    and (board = 'geral' or public.is_campaign_master(campaign_id, auth.uid()))
  );
