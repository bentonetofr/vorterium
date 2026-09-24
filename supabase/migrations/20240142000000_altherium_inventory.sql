-- ============================================================
-- Vorterium — Inventário (armas, armaduras, itens) da ficha Altherium
-- Migration: 20240142000000_altherium_inventory.sql
-- Aplicar após: 20240141000000_altherium_portrait.sql
-- ============================================================
--
-- O catálogo (armas, proteções, consumíveis, utilitários) é dado fixo
-- do livro de regras — vive em código
-- (src/features/sheets/altherium/constants/altheriumItems.ts), não
-- numa tabela. Aqui só guardamos o que cada personagem possui,
-- referenciando o catálogo pelo item_id (sem FK — o catálogo não é
-- uma tabela do banco).

create table public.altherium_character_inventory (
  id             uuid        primary key default gen_random_uuid(),
  sheet_id       uuid        not null references public.altherium_character_sheets(id) on delete cascade,
  item_type      text        not null check (item_type in ('arma', 'armadura', 'escudo', 'consumivel', 'utilitario')),
  item_id        text        not null,
  quantity       integer     not null default 1 check (quantity >= 1),

  -- Equipar só é aplicável a armadura/escudo. equipped_zone usa os
  -- mesmos valores das colunas de DB da ficha (db_pernas etc.) —
  -- null quando o item cobre "o corpo todo" (escudo) ou não é
  -- equipável (arma/consumível/utilitário).
  equipped       boolean     not null default false,
  equipped_zone  text        check (equipped_zone in ('db_cabeca', 'db_bracos', 'db_tronco', 'db_pernas')),

  created_at     timestamptz not null default now(),

  unique (sheet_id, item_type, item_id)
);

create index idx_altherium_inventory_sheet_id on public.altherium_character_inventory(sheet_id);

alter table public.altherium_character_inventory enable row level security;

-- Mesmo critério de acesso da própria ficha (ver policies de
-- altherium_character_sheets e altherium_character_domains): dono ou
-- mestre da campanha podem ver e escrever.

create policy "altherium_inventory: dono ou mestre pode ver"
  on public.altherium_character_inventory for select
  to authenticated
  using (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

create policy "altherium_inventory: dono ou mestre pode inserir"
  on public.altherium_character_inventory for insert
  to authenticated
  with check (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

create policy "altherium_inventory: dono ou mestre pode atualizar"
  on public.altherium_character_inventory for update
  to authenticated
  using (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );

create policy "altherium_inventory: dono ou mestre pode remover"
  on public.altherium_character_inventory for delete
  to authenticated
  using (
    exists (
      select 1 from public.altherium_character_sheets s
      where s.id = sheet_id
        and (s.user_id = auth.uid() or public.is_campaign_master(s.campaign_id, auth.uid()))
    )
  );
